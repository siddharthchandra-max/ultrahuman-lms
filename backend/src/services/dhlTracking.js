const axios = require('axios');

const DHL_API_URL = process.env.DHL_API_URL || 'https://api-eu.dhl.com/track/shipments';
const DHL_API_KEY = process.env.DHL_API_KEY;

const MILESTONE_MAP = {
  'pre-transit': 'Booked',
  'transit': 'In Transit',
  'customs': 'Customs',
  'out-for-delivery': 'Out for Delivery',
  'delivered': 'Delivered',
  'failure': 'Failed',
  'return': 'Returned',
  'unknown': 'In Transit',
};

function mapStatusToMilestone(statusCode) {
  if (!statusCode) return 'In Transit';
  const key = statusCode.toLowerCase().replace(/\s+/g, '-');
  return MILESTONE_MAP[key] || 'In Transit';
}

function parseEvents(dhlShipment) {
  const events = [];
  if (!dhlShipment?.events) return events;

  for (const ev of dhlShipment.events) {
    events.push({
      timestamp: new Date(ev.timestamp),
      location: ev.location?.address?.addressLocality || '',
      locationCode: ev.location?.address?.countryCode || '',
      statusCode: ev.statusCode || '',
      description: ev.description || ev.status || '',
      milestone: mapStatusToMilestone(ev.statusCode),
    });
  }

  // Sort newest first
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
}

async function trackSingleAWB(awb) {
  if (!DHL_API_KEY) {
    return { awb, events: [], error: 'DHL_API_KEY not configured' };
  }

  try {
    const res = await axios.get(DHL_API_URL, {
      params: { trackingNumber: awb },
      headers: { 'DHL-API-Key': DHL_API_KEY },
      timeout: 15000,
    });

    const shipments = res.data?.shipments;
    if (!shipments || shipments.length === 0) {
      return { awb, events: [], error: 'No tracking data found' };
    }

    const events = parseEvents(shipments[0]);
    const estimatedDelivery = shipments[0]?.estimatedTimeOfDelivery
      ? new Date(shipments[0].estimatedTimeOfDelivery)
      : null;

    return { awb, events, estimatedDelivery, error: null };
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || 'Tracking API error';
    return { awb, events: [], error: msg };
  }
}

async function trackBatchAWBs(awbs) {
  const results = {};
  const chunks = [];

  // DHL allows up to 10 tracking numbers per request
  for (let i = 0; i < awbs.length; i += 10) {
    chunks.push(awbs.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    if (!DHL_API_KEY) {
      for (const awb of chunk) {
        results[awb] = { events: [], error: 'DHL_API_KEY not configured' };
      }
      continue;
    }

    try {
      const res = await axios.get(DHL_API_URL, {
        params: { trackingNumber: chunk.join(',') },
        headers: { 'DHL-API-Key': DHL_API_KEY },
        timeout: 30000,
      });

      const shipments = res.data?.shipments || [];
      for (const s of shipments) {
        const trackingNum = s.id || s.trackingNumber;
        results[trackingNum] = {
          events: parseEvents(s),
          estimatedDelivery: s.estimatedTimeOfDelivery ? new Date(s.estimatedTimeOfDelivery) : null,
          error: null,
        };
      }

      // Mark missing AWBs
      for (const awb of chunk) {
        if (!results[awb]) {
          results[awb] = { events: [], error: 'No tracking data found' };
        }
      }
    } catch (err) {
      for (const awb of chunk) {
        if (!results[awb]) {
          results[awb] = { events: [], error: err.message };
        }
      }
    }

    // Rate limit: small delay between batches
    if (chunks.length > 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

function computeTrackingStatus(events, shipmentDate, estimatedDelivery) {
  const status = {
    currentMilestone: 'Booked',
    lastEvent: '',
    lastEventTime: null,
    lastTrackedAt: new Date(),
    isDelivered: false,
    isDelayed: false,
    estimatedDelivery: estimatedDelivery || null,
    daysInTransit: 0,
  };

  if (events.length > 0) {
    const latest = events[0]; // Already sorted newest first
    status.currentMilestone = latest.milestone;
    status.lastEvent = latest.description;
    status.lastEventTime = latest.timestamp;
    status.isDelivered = latest.milestone === 'Delivered';
  }

  // Calculate days in transit
  const startDate = shipmentDate ? new Date(shipmentDate) : null;
  if (startDate) {
    const endDate = status.isDelivered && status.lastEventTime
      ? status.lastEventTime
      : new Date();
    status.daysInTransit = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  }

  // Delayed detection: 7+ days in transit OR no update in 48+ hours
  if (!status.isDelivered) {
    if (status.daysInTransit > 7) {
      status.isDelayed = true;
    }
    if (status.lastEventTime) {
      const hoursSinceUpdate = (Date.now() - status.lastEventTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate > 48) {
        status.isDelayed = true;
      }
    }
  }

  return status;
}

module.exports = { trackSingleAWB, trackBatchAWBs, computeTrackingStatus, mapStatusToMilestone };
