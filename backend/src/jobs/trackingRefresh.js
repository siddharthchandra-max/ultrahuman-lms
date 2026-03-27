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

      const baseQuery = {
        'trackingStatus.isDelivered': { $ne: true },
        shipmentDate: { $gte: sixtyDaysAgo },
        awb: { $exists: true, $ne: '' },
        $or: [
          { 'trackingStatus.lastTrackedAt': { $lt: tenMinAgo } },
          { 'trackingStatus.lastTrackedAt': { $exists: false } },
        ],
      };

      // Fetch DHL/BlueDart/FedEx and UPS separately with their own limits
      const [dhlShipments, upsShipments] = await Promise.all([
        Shipment.find({
          ...baseQuery,
          $expr: {
            $or: [
              { $eq: [{ $type: '$courier' }, 'missing'] },
              { $eq: ['$courier', ''] },
              { $eq: ['$courier', null] },
              { $regexMatch: { input: { $toLower: '$courier' }, regex: /dhl|bluedart|fedex/ } },
            ],
          },
        }).select('awb courier shipmentDate dispatchDate trackingEvents trackingStatus').limit(300),
        Shipment.find({
          ...baseQuery,
          courier: { $regex: /ups/i },
        }).select('awb courier shipmentDate dispatchDate trackingEvents trackingStatus').limit(200),
      ]);

      const totalActive = dhlShipments.length + upsShipments.length;
      if (totalActive === 0) {
        console.log('[Cron] No shipments need refresh');
        return;
      }

      const updateShipments = async (results) => {
        let updated = 0;
        for (const [awb, data] of Object.entries(results)) {
          const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });
          if (!shipment) continue;

          // Always stamp lastTrackedAt so we don't re-query this AWB next cycle
          if (!shipment.trackingStatus) shipment.trackingStatus = {};
          shipment.trackingStatus.lastTrackedAt = new Date();

          // If no events returned, just save the timestamp and move on
          if (!data.events || data.events.length === 0) {
            await shipment.save();
            continue;
          }

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

      // Track DHL/BlueDart/FedEx and UPS in parallel
      const [dhlUpdated, upsUpdated] = await Promise.all([
        (async () => {
          if (dhlShipments.length === 0) return 0;
          const awbs = dhlShipments.map(s => s.awb);
          console.log(`[Cron] Tracking ${awbs.length} DHL/BlueDart/FedEx shipments...`);
          const results = await dhlTrackBatch(awbs);
          return updateShipments(results);
        })(),
        (async () => {
          if (upsShipments.length === 0) return 0;
          const awbs = upsShipments.map(s => s.awb);
          console.log(`[Cron] Tracking ${awbs.length} UPS shipments...`);
          const results = await upsTrackBatch(awbs);
          return updateShipments(results);
        })(),
      ]);

      console.log(`[Cron] Updated ${dhlUpdated + upsUpdated}/${totalActive} shipments (DHL: ${dhlUpdated}/${dhlShipments.length}, UPS: ${upsUpdated}/${upsShipments.length})`);
    } catch (err) {
      console.error('[Cron] Tracking refresh error:', err.message);
    }
  });

  console.log('Tracking refresh cron scheduled (every 10 min)');

  // UPS Quantum View sync — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Cron] Running UPS shipment sync...');
    try {
      const { fetchUPSShipments } = require('../services/upsQuantumView');
      const result = await fetchUPSShipments();
      console.log(`[Cron] UPS sync: ${result.imported} imported, ${result.updated} updated`);
    } catch (err) {
      console.error('[Cron] UPS sync error:', err.message);
    }
  });

  console.log('UPS shipment sync cron scheduled (every 30 min)');
}

module.exports = { start };
