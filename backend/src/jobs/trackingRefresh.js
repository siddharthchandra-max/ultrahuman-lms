const cron = require('node-cron');
const Shipment = require('../models/Shipment');
const { trackBatchAWBs: dhlTrackBatch, computeTrackingStatus, findPickupEvent } = require('../services/dhlTracking');
const { trackBatchAWBs: upsTrackBatch } = require('../services/upsTracking');

// Guard: prevent overlapping cron runs
let isRunning = false;

function start() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    if (isRunning) {
      console.log('[Cron] Previous tracking refresh still running, skipping this cycle');
      return;
    }
    isRunning = true;
    const startTime = Date.now();
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

      // Fetch all active shipments
      const active = await Shipment.find(baseQuery)
        .select('awb courier')
        .lean();

      // Group by courier
      const dhlAwbs = [];
      const upsAwbs = [];
      for (const s of active) {
        const c = (s.courier || '').toLowerCase();
        if (c.includes('ups')) {
          upsAwbs.push(s.awb);
        } else {
          // DHL, BlueDart, FedEx, or unknown — all go through DHL Unified API
          dhlAwbs.push(s.awb);
        }
      }

      const totalActive = dhlAwbs.length + upsAwbs.length;
      if (totalActive === 0) {
        console.log('[Cron] No shipments need refresh');
        return;
      }

      console.log(`[Cron] Found ${totalActive} shipments to track (DHL/BlueDart/FedEx: ${dhlAwbs.length}, UPS: ${upsAwbs.length})`);

      // Process a chunk of AWBs — track via API then update DB
      const processChunk = async (awbs, trackFn, label) => {
        if (awbs.length === 0) return 0;

        console.log(`[Cron] ${label}: tracking ${awbs.length} AWBs...`);
        const results = await trackFn(awbs);

        let updated = 0;
        let stamped = 0;
        for (const [awb, data] of Object.entries(results)) {
          try {
            const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });
            if (!shipment) continue;

            // Always stamp lastTrackedAt
            if (!shipment.trackingStatus) shipment.trackingStatus = {};
            shipment.trackingStatus.lastTrackedAt = new Date();
            stamped++;

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

            if (!shipment.dispatchDate) {
              const pickupEvent = findPickupEvent(shipment.trackingEvents);
              if (pickupEvent) {
                shipment.dispatchDate = new Date(pickupEvent.timestamp);
                const startOfYear = new Date(shipment.dispatchDate.getFullYear(), 0, 1);
                shipment.week = 'W' + Math.ceil(((shipment.dispatchDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
              }
            }

            await shipment.save();
            updated++;
          } catch (err) {
            // Don't let one bad shipment kill the whole batch
            console.error(`[Cron] Error updating ${awb}:`, err.message);
          }
        }

        console.log(`[Cron] ${label}: ${updated} updated, ${stamped} stamped out of ${awbs.length}`);
        return updated;
      };

      // Process in chunks of 500 for DHL, 200 for UPS — parallel between couriers
      const CHUNK_DHL = 500;
      const CHUNK_UPS = 200;

      let dhlTotal = 0;
      let upsTotal = 0;

      // Run DHL and UPS processing in parallel
      await Promise.all([
        // DHL/BlueDart/FedEx — chunks of 500
        (async () => {
          for (let i = 0; i < dhlAwbs.length; i += CHUNK_DHL) {
            const chunk = dhlAwbs.slice(i, i + CHUNK_DHL);
            dhlTotal += await processChunk(chunk, dhlTrackBatch, `DHL chunk ${Math.floor(i / CHUNK_DHL) + 1}`);
          }
        })(),
        // UPS — chunks of 200, 10 parallel requests per chunk
        (async () => {
          for (let i = 0; i < upsAwbs.length; i += CHUNK_UPS) {
            const chunk = upsAwbs.slice(i, i + CHUNK_UPS);
            upsTotal += await processChunk(chunk, (awbs) => upsTrackBatch(awbs, 10), `UPS chunk ${Math.floor(i / CHUNK_UPS) + 1}`);
          }
        })(),
      ]);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Cron] Done in ${elapsed}s — Updated ${dhlTotal + upsTotal}/${totalActive} (DHL: ${dhlTotal}/${dhlAwbs.length}, UPS: ${upsTotal}/${upsAwbs.length})`);
    } catch (err) {
      console.error('[Cron] Tracking refresh error:', err.message);
    } finally {
      isRunning = false;
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
