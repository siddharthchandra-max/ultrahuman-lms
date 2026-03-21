const cron = require('node-cron');
const Shipment = require('../models/Shipment');
const { trackBatchAWBs, computeTrackingStatus } = require('../services/dhlTracking');

function start() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    if (!process.env.DHL_API_KEY) return;

    console.log('[Cron] Refreshing active shipment tracking...');
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const active = await Shipment.find({
        'trackingStatus.isDelivered': { $ne: true },
        shipmentDate: { $gte: sixtyDaysAgo },
        awb: { $exists: true, $ne: '' },
        $or: [
          { 'trackingStatus.lastTrackedAt': { $lt: thirtyMinAgo } },
          { 'trackingStatus.lastTrackedAt': { $exists: false } },
        ],
      }).select('awb shipmentDate trackingEvents trackingStatus').limit(200);

      const awbs = [...new Set(active.map(s => s.awb).filter(Boolean))];
      if (awbs.length === 0) {
        console.log('[Cron] No shipments need refresh');
        return;
      }

      console.log(`[Cron] Tracking ${awbs.length} shipments...`);
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

      console.log(`[Cron] Updated ${updated}/${awbs.length} shipments`);
    } catch (err) {
      console.error('[Cron] Tracking refresh error:', err.message);
    }
  });

  console.log('Tracking refresh cron scheduled (every 30 min)');
}

module.exports = { start };
