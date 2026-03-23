const cron = require('node-cron');
const Shipment = require('../models/Shipment');
const { trackBatchAWBs: dhlTrackBatch, computeTrackingStatus } = require('../services/dhlTracking');
const { trackBatchAWBs: upsTrackBatch } = require('../services/upsTracking');

function start() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Refreshing active shipment tracking...');
    try {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const active = await Shipment.find({
        'trackingStatus.isDelivered': { $ne: true },
        shipmentDate: { $gte: sixtyDaysAgo },
        awb: { $exists: true, $ne: '' },
        $or: [
          { 'trackingStatus.lastTrackedAt': { $lt: tenMinAgo } },
          { 'trackingStatus.lastTrackedAt': { $exists: false } },
        ],
      }).select('awb courier shipmentDate dispatchDate trackingEvents trackingStatus').limit(200);

      if (active.length === 0) {
        console.log('[Cron] No shipments need refresh');
        return;
      }

      // Group by courier
      const dhlAwbs = active.filter(s => !s.courier || s.courier.toLowerCase().includes('dhl')).map(s => s.awb);
      const upsAwbs = active.filter(s => s.courier && s.courier.toLowerCase().includes('ups')).map(s => s.awb);

      const updateShipments = async (results) => {
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

          // Set dispatch date and week from pickup event
          if (!shipment.dispatchDate) {
            const pickupEvent = shipment.trackingEvents.filter(e => e.statusCode === 'PU' || e.statusCode === 'DP').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
            if (pickupEvent) {
              shipment.dispatchDate = new Date(pickupEvent.timestamp);
              const startOfYear = new Date(shipment.dispatchDate.getFullYear(), 0, 1);
              shipment.week = 'W' + Math.ceil(((shipment.dispatchDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
            }
          }

          await shipment.save();
          updated++;
        }
        return updated;
      };

      let totalUpdated = 0;

      // Track DHL
      if (dhlAwbs.length > 0) {
        console.log(`[Cron] Tracking ${dhlAwbs.length} DHL shipments...`);
        const results = await dhlTrackBatch(dhlAwbs);
        totalUpdated += await updateShipments(results);
      }

      // Track UPS
      if (upsAwbs.length > 0) {
        console.log(`[Cron] Tracking ${upsAwbs.length} UPS shipments...`);
        const results = await upsTrackBatch(upsAwbs);
        totalUpdated += await updateShipments(results);
      }

      console.log(`[Cron] Updated ${totalUpdated}/${active.length} shipments`);
    } catch (err) {
      console.error('[Cron] Tracking refresh error:', err.message);
    }
  });

  console.log('Tracking refresh cron scheduled (every 10 min)');
}

module.exports = { start };
