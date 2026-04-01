const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Shipment = require('../models/Shipment');
const { trackSingleAWB: dhlTrackSingle, trackBatchAWBs: dhlTrackBatch, computeTrackingStatus, mapEventCodeToMilestone } = require('../services/dhlTracking');
const { trackSingleAWB: upsTrackSingle, trackBatchAWBs: upsTrackBatch } = require('../services/upsTracking');

// Pick the right tracker based on courier
function getTracker(courier) {
  if (!courier) return { single: dhlTrackSingle, batch: dhlTrackBatch, name: 'DHL' };
  const c = courier.toLowerCase();
  if (c.includes('ups')) return { single: upsTrackSingle, batch: upsTrackBatch, name: 'UPS' };
  return { single: dhlTrackSingle, batch: dhlTrackBatch, name: 'DHL' };
}

// Track single AWB
router.get('/:awb', auth, async (req, res) => {
  try {
    const { awb } = req.params;
    const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });

    if (!shipment) {
      // AWB not in our system — try DHL by default
      const result = await dhlTrackSingle(awb);
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
      const tracker = getTracker(shipment.courier);
      const result = await tracker.single(awb);

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
        const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, result.estimatedDelivery, shipment.dispatchDate);
        shipment.trackingStatus = ts;
        shipment.status = ts.currentMilestone;

        // Set dispatch date and week from first Picked Up (PU) event
        if (!shipment.dispatchDate) {
          const pickupEvent = shipment.trackingEvents.filter(e => e.statusCode === 'PU' || e.statusCode === 'DP').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
          if (pickupEvent) {
            shipment.dispatchDate = new Date(pickupEvent.timestamp);
            const startOfYear = new Date(shipment.dispatchDate.getFullYear(), 0, 1);
            shipment.week = 'W' + Math.ceil(((shipment.dispatchDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
          }
        }
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

      const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, data.estimatedDelivery, shipment.dispatchDate);
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

      const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, data.estimatedDelivery, shipment.dispatchDate);
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

// Debug: test DHL raw API call
router.get('/debug/test/:awb', async (req, res) => {
  try {
    const axios = require('axios');
    const DHL_API_URL = process.env.DHL_API_URL || 'https://xmlpi-ea.dhl.com/XMLShippingServlet';
    const DHL_SITE_ID = process.env.DHL_SITE_ID;
    const DHL_PASSWORD = process.env.DHL_PASSWORD;
    const awb = req.params.awb;
    const now = new Date().toISOString();
    const msgRef = ('UH_LMS_TRACK_' + Date.now()).substring(0, 28).padEnd(28, '0');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<req:KnownTrackingRequest xmlns:req="http://www.dhl.com" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.dhl.com TrackingRequestKnown-1.0.xsd" schemaVersion="1.0">
  <Request>
    <ServiceHeader>
      <MessageTime>${now}</MessageTime>
      <MessageReference>${msgRef}</MessageReference>
      <SiteID>${DHL_SITE_ID}</SiteID>
      <Password>${DHL_PASSWORD.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}</Password>
    </ServiceHeader>
  </Request>
  <LanguageCode>en</LanguageCode>
  <AWBNumber>
    <ArrayOfAWBNumberItem>${awb}</ArrayOfAWBNumberItem>
  </AWBNumber>
  <LevelOfDetails>ALL_CHECKPOINTS</LevelOfDetails>
  <PiecesEnabled>S</PiecesEnabled>
</req:KnownTrackingRequest>`;

    const response = await axios.post(DHL_API_URL, xmlBody, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 20000,
      responseType: 'text',
    });

    res.set('Content-Type', 'text/xml');
    res.send(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, response: err.response?.data?.substring?.(0, 1000) });
  }
});

// Debug: test UPS tracking
router.get('/debug/ups/:awb', async (req, res) => {
  try {
    const result = await upsTrackSingle(req.params.awb);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync UPS shipments (Quantum View / Shipping History)
router.post('/ups-sync', auth, async (req, res) => {
  try {
    const { fetchUPSShipments } = require('../services/upsQuantumView');
    const fromDate = req.body.fromDate || null;
    const result = await fetchUPSShipments(fromDate);
    res.json(result);
  } catch (err) {
    console.error('[UPS Sync] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Import UPS AWBs — create shipments + auto-track
router.post('/ups-import', auth, async (req, res) => {
  try {
    const { awbs } = req.body;
    if (!awbs || !Array.isArray(awbs) || awbs.length === 0) {
      return res.status(400).json({ error: 'Provide awbs array' });
    }

    let imported = 0;
    const now = new Date();

    // Create shipments for AWBs that don't exist
    for (const awb of awbs) {
      const existing = await Shipment.findOne({ awb });
      if (!existing) {
        await Shipment.create({
          awb,
          courier: 'UPS',
          status: 'Booked',
          uploadDate: now,
          logisticsType: 'Cross Border',
        });
        imported++;
      }
    }

    // Send response immediately, track in background
    res.json({ imported, tracked: 0, total: awbs.length, message: 'Tracking in background...' });

    // Background: track all AWBs and enrich shipment data
    const { computeTrackingStatus } = require('../services/dhlTracking');
    upsTrackBatch(awbs).then(async (results) => {
      let tracked = 0;
      for (const [awb, data] of Object.entries(results)) {
        if (!data.events || data.events.length === 0) continue;
        const shipment = await Shipment.findOne({ awb });
        if (!shipment) continue;

        shipment.trackingEvents = data.events;
        const ts = computeTrackingStatus(data.events, shipment.shipmentDate, data.estimatedDelivery, shipment.dispatchDate);
        shipment.trackingStatus = ts;
        shipment.status = ts.currentMilestone;

        if (data.estimatedDelivery) shipment.edd = data.estimatedDelivery;
        if (data.destCountry && (!shipment.destCode || shipment.destCode === '-')) shipment.destCode = data.destCountry;
        if (data.originCountry && (!shipment.sourceCountry || shipment.sourceCountry === '-')) shipment.sourceCountry = data.originCountry;
        if (data.origin?.description && (!shipment.sourceCity || shipment.sourceCity === '-')) shipment.sourceCity = data.origin.description;
        if (data.destination?.description && (!shipment.destCity || shipment.destCity === '-')) shipment.destCity = data.destination.description;
        if (data.weight && !shipment.weight) shipment.weight = data.weight;

        // Dispatch date + week from pickup event
        const pickupEvent = data.events.filter(e => e.statusCode === 'PU' || e.statusCode === 'DP')
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
        if (pickupEvent) {
          shipment.dispatchDate = new Date(pickupEvent.timestamp);
          shipment.shipmentDate = shipment.shipmentDate || shipment.dispatchDate;
          const startOfYear = new Date(shipment.dispatchDate.getFullYear(), 0, 1);
          shipment.week = 'W' + Math.ceil(((shipment.dispatchDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        }

        // Derive month
        const dateForMonth = shipment.shipmentDate || shipment.dispatchDate;
        if (dateForMonth) {
          shipment.month = new Date(dateForMonth).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        }

        await shipment.save();
        tracked++;
      }
      console.log(`[UPS Import] Tracked ${tracked}/${awbs.length} AWBs`);
    }).catch(err => console.error('[UPS Import] Background tracking error:', err.message));

  } catch (err) {
    console.error('[UPS Import] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
