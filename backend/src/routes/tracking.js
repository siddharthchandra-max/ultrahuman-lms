const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Shipment = require('../models/Shipment');
const { trackSingleAWB, trackBatchAWBs, computeTrackingStatus } = require('../services/dhlTracking');

// Track single AWB
router.get('/:awb', auth, async (req, res) => {
  try {
    const { awb } = req.params;
    const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });

    if (!shipment) {
      // AWB not in our system — still try DHL API
      const result = await trackSingleAWB(awb);
      return res.json({
        awb,
        found: false,
        tracking: result.events,
        error: result.error,
      });
    }

    // Check if we need to refresh (older than 15 min)
    const lastTracked = shipment.trackingStatus?.lastTrackedAt;
    const needsRefresh = !lastTracked || (Date.now() - lastTracked.getTime()) > 15 * 60 * 1000;

    if (needsRefresh) {
      const result = await trackSingleAWB(awb);

      if (result.events.length > 0) {
        // Merge events (deduplicate by timestamp + statusCode)
        const existing = new Set(
          (shipment.trackingEvents || []).map(e => `${e.timestamp?.toISOString()}_${e.statusCode}`)
        );
        const newEvents = result.events.filter(
          e => !existing.has(`${e.timestamp.toISOString()}_${e.statusCode}`)
        );
        shipment.trackingEvents = [...(shipment.trackingEvents || []), ...newEvents]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Update tracking status
        const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, result.estimatedDelivery);
        shipment.trackingStatus = ts;
        shipment.status = ts.currentMilestone;
      } else {
        // Update lastTrackedAt even if no events
        if (!shipment.trackingStatus) shipment.trackingStatus = {};
        shipment.trackingStatus.lastTrackedAt = new Date();
      }

      await shipment.save();
    }

    res.json({
      awb: shipment.awb,
      found: true,
      shipment: {
        _id: shipment._id,
        awb: shipment.awb,
        invoiceNumber: shipment.invoiceNumber,
        shipmentDate: shipment.shipmentDate,
        week: shipment.week,
        month: shipment.month,
        productName: shipment.productName,
        destCode: shipment.destCode,
        destName: shipment.destName,
        receiverName: shipment.receiverName,
        receiverCity: shipment.receiverCity,
        weight: shipment.weight,
        totalInclVAT: shipment.totalInclVAT,
        status: shipment.status,
        courier: shipment.courier,
      },
      trackingStatus: shipment.trackingStatus,
      tracking: shipment.trackingEvents || [],
    });
  } catch (err) {
    console.error('Track error:', err.message);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// Batch track multiple AWBs
router.post('/batch', auth, async (req, res) => {
  try {
    const { awbs } = req.body;
    if (!awbs || !Array.isArray(awbs) || awbs.length === 0) {
      return res.status(400).json({ error: 'Provide awbs array' });
    }
    if (awbs.length > 100) {
      return res.status(400).json({ error: 'Max 100 AWBs per batch' });
    }

    const results = await trackBatchAWBs(awbs);
    let updated = 0;
    const errors = [];

    for (const [awb, data] of Object.entries(results)) {
      if (data.error) {
        errors.push({ awb, error: data.error });
        continue;
      }
      if (data.events.length === 0) continue;

      const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });
      if (!shipment) continue;

      const existing = new Set(
        (shipment.trackingEvents || []).map(e => `${e.timestamp?.toISOString()}_${e.statusCode}`)
      );
      const newEvents = data.events.filter(
        e => !existing.has(`${e.timestamp.toISOString()}_${e.statusCode}`)
      );
      shipment.trackingEvents = [...(shipment.trackingEvents || []), ...newEvents]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, data.estimatedDelivery);
      shipment.trackingStatus = ts;
      shipment.status = ts.currentMilestone;
      await shipment.save();
      updated++;
    }

    res.json({ updated, errors, total: awbs.length });
  } catch (err) {
    console.error('Batch track error:', err.message);
    res.status(500).json({ error: 'Batch tracking failed' });
  }
});

// Refresh all active (non-delivered) shipments
router.post('/refresh-active', auth, async (req, res) => {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const active = await Shipment.find({
      'trackingStatus.isDelivered': { $ne: true },
      shipmentDate: { $gte: sixtyDaysAgo },
      awb: { $exists: true, $ne: '' },
    }).select('awb').limit(500);

    const awbs = [...new Set(active.map(s => s.awb).filter(Boolean))];
    if (awbs.length === 0) return res.json({ updated: 0, total: 0 });

    const results = await trackBatchAWBs(awbs);
    let updated = 0;

    for (const [awb, data] of Object.entries(results)) {
      if (!data.events || data.events.length === 0) continue;

      const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });
      if (!shipment) continue;

      const existing = new Set(
        (shipment.trackingEvents || []).map(e => `${e.timestamp?.toISOString()}_${e.statusCode}`)
      );
      const newEvents = data.events.filter(
        e => !existing.has(`${e.timestamp.toISOString()}_${e.statusCode}`)
      );
      shipment.trackingEvents = [...(shipment.trackingEvents || []), ...newEvents]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, data.estimatedDelivery);
      shipment.trackingStatus = ts;
      shipment.status = ts.currentMilestone;
      await shipment.save();
      updated++;
    }

    res.json({ updated, total: awbs.length });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// Tracking alerts — delayed/stuck shipments
router.get('/alerts/list', auth, async (req, res) => {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const delayed = await Shipment.find({
      'trackingStatus.isDelivered': { $ne: true },
      shipmentDate: { $gte: sixtyDaysAgo },
      awb: { $exists: true, $ne: '' },
      $or: [
        { 'trackingStatus.isDelayed': true },
        { 'trackingStatus.daysInTransit': { $gt: 7 } },
      ],
    })
      .select('awb destCode destName shipmentDate status trackingStatus productName weight')
      .sort({ 'trackingStatus.daysInTransit': -1 })
      .limit(100);

    res.json(delayed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Tracking summary — counts by milestone
router.get('/summary/stats', auth, async (req, res) => {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { shipmentDate: { $gte: sixtyDaysAgo }, awb: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { $ifNull: ['$trackingStatus.currentMilestone', '$status'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ];

    const byMilestone = await Shipment.aggregate(pipeline);

    const delayedCount = await Shipment.countDocuments({
      shipmentDate: { $gte: sixtyDaysAgo },
      'trackingStatus.isDelayed': true,
      'trackingStatus.isDelivered': { $ne: true },
    });

    const totalActive = await Shipment.countDocuments({
      shipmentDate: { $gte: sixtyDaysAgo },
      'trackingStatus.isDelivered': { $ne: true },
      awb: { $exists: true, $ne: '' },
    });

    res.json({ byMilestone, delayedCount, totalActive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tracking summary' });
  }
});

module.exports = router;
