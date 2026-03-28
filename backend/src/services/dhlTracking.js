const axios = require('axios');

// DHL Express XML PI Tracking
const DHL_API_URL = process.env.DHL_API_URL || 'https://xmlpi-ea.dhl.com/XMLShippingServlet';
const DHL_SITE_ID = process.env.DHL_SITE_ID;
const DHL_PASSWORD = process.env.DHL_PASSWORD;

// DHL Unified Tracking API (REST)
const DHL_UNIFIED_API_KEY = process.env.DHL_UNIFIED_API_KEY;

// Event code → milestone mapping
// Covers both DHL XML PI codes (PU, AF, etc.) and DHL Unified API codes (transit, delivered, etc.)
const EVENT_CODE_MAP = {
  // DHL XML PI codes
  'PU': 'Picked Up',
  'AF': 'In Transit',
  'PL': 'In Transit',
  'DF': 'In Transit',
  'AR': 'In Transit',
  'RR': 'Customs',
  'CR': 'Customs',
  'CC': 'Customs',
  'CD': 'Customs',
  'IC': 'Customs',
  'WC': 'Out for Delivery',
  'OK': 'Delivered',
  'DL': 'Delivered',
  'DD': 'Delivered',
  'OH': 'Failed',
  'NH': 'Failed',
  'BA': 'Failed',
  'MS': 'Failed',
  'CA': 'Failed',
  'RT': 'Returned',
  'RD': 'Returned',
  'BN': 'Booked',
  // DHL Unified API codes (lowercase)
  'PRE-TRANSIT': 'Booked',
  'TRANSIT': 'In Transit',
  'DELIVERED': 'Delivered',
  'FAILURE': 'Failed',
  'UNKNOWN': 'In Transit',
};

function mapEventCodeToMilestone(eventCode) {
  if (!eventCode) return 'In Transit';
  return EVENT_CODE_MAP[eventCode.toUpperCase()] || EVENT_CODE_MAP[eventCode] || 'In Transit';
}

// Simple XML tag extractor (no external dependency needed)
function getTagValue(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function getAllBlocks(xml, tag) {
  const blocks = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

// XML-escape special characters
function xmlEscape(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Build DHL XML tracking request
function buildTrackingXML(awbs) {
  const awbArray = Array.isArray(awbs) ? awbs : [awbs];
  const now = new Date().toISOString();
  const msgRef = ('UH_LMS_TRACK_' + Date.now()).substring(0, 28).padEnd(28, '0');

  const awbElements = awbArray.map(awb => `<ArrayOfAWBNumberItem>${awb}</ArrayOfAWBNumberItem>`).join('\n      ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<req:KnownTrackingRequest xmlns:req="http://www.dhl.com" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.dhl.com TrackingRequestKnown-1.0.xsd" schemaVersion="1.0">
  <Request>
    <ServiceHeader>
      <MessageTime>${now}</MessageTime>
      <MessageReference>${msgRef}</MessageReference>
      <SiteID>${xmlEscape(DHL_SITE_ID)}</SiteID>
      <Password>${xmlEscape(DHL_PASSWORD)}</Password>
    </ServiceHeader>
  </Request>
  <LanguageCode>en</LanguageCode>
  <AWBNumber>
    ${awbElements}
  </AWBNumber>
  <LevelOfDetails>ALL_CHECKPOINTS</LevelOfDetails>
  <PiecesEnabled>S</PiecesEnabled>
</req:KnownTrackingRequest>`;
}

// Parse DHL XML response
function parseXMLResponse(xml) {
  const results = {};

  // Get all AWBInfo items
  const awbInfoBlocks = getAllBlocks(xml, 'ArrayOfAWBInfoItem');

  for (const block of awbInfoBlocks) {
    const awb = getTagValue(block, 'AWBNumber');
    if (!awb) continue;

    const actionStatus = getTagValue(block, 'ActionStatus');
    if (actionStatus !== 'Success') {
      results[awb] = { events: [], error: actionStatus || 'Tracking failed' };
      continue;
    }

    // Get ShipmentInfo
    const shipInfoBlocks = getAllBlocks(block, 'ShipmentInfo');
    if (!shipInfoBlocks.length) {
      results[awb] = { events: [], error: 'No shipment info' };
      continue;
    }
    const shipInfo = shipInfoBlocks[0];

    // Origin/Destination
    const originBlocks = getAllBlocks(shipInfo, 'OriginServiceArea');
    const destBlocks = getAllBlocks(shipInfo, 'DestinationServiceArea');
    const originCode = originBlocks.length ? getTagValue(originBlocks[0], 'ServiceAreaCode') : null;
    const originDesc = originBlocks.length ? getTagValue(originBlocks[0], 'Description') : null;
    const destCode = destBlocks.length ? getTagValue(destBlocks[0], 'ServiceAreaCode') : null;
    const destDesc = destBlocks.length ? getTagValue(destBlocks[0], 'Description') : null;

    const shipmentDate = getTagValue(shipInfo, 'ShipmentDate');
    const pieces = getTagValue(shipInfo, 'Pieces');
    const weight = getTagValue(shipInfo, 'Weight');
    const weightUnit = getTagValue(shipInfo, 'WeightUnit');
    const shipmentDesc = getTagValue(shipInfo, 'ShipmentDescription');

    // Shipper/Consignee country
    const shipperBlocks = getAllBlocks(shipInfo, 'Shipper');
    const consigneeBlocks = getAllBlocks(shipInfo, 'Consignee');
    const originCountry = shipperBlocks.length ? getTagValue(shipperBlocks[0], 'CountryCode') : null;
    const destCountry = consigneeBlocks.length ? getTagValue(consigneeBlocks[0], 'CountryCode') : null;

    // Shipper reference (UHR number)
    const refBlocks = getAllBlocks(shipInfo, 'ShipperReference');
    const shipperRef = refBlocks.length ? getTagValue(refBlocks[0], 'ReferenceID') : null;

    // Parse events
    const eventBlocks = getAllBlocks(shipInfo, 'ArrayOfShipmentEventItem');
    const events = [];

    for (const evBlock of eventBlocks) {
      const date = getTagValue(evBlock, 'Date');
      const time = getTagValue(evBlock, 'Time');
      const timestamp = date && time ? new Date(`${date}T${time}`) : null;

      const serviceEventBlocks = getAllBlocks(evBlock, 'ServiceEvent');
      const eventCode = serviceEventBlocks.length ? getTagValue(serviceEventBlocks[0], 'EventCode') : null;
      const description = serviceEventBlocks.length ? getTagValue(serviceEventBlocks[0], 'Description') : null;

      const serviceAreaBlocks = getAllBlocks(evBlock, 'ServiceArea');
      const locationCode = serviceAreaBlocks.length ? getTagValue(serviceAreaBlocks[0], 'ServiceAreaCode') : null;
      const locationDesc = serviceAreaBlocks.length ? getTagValue(serviceAreaBlocks[0], 'Description') : null;

      const remarkBlocks = getAllBlocks(evBlock, 'EventRemarks');
      const remarks = remarkBlocks.length ? getTagValue(remarkBlocks[0], 'FurtherDetails') : null;

      if (timestamp) {
        events.push({
          timestamp,
          location: locationDesc || '',
          locationCode: locationCode || '',
          statusCode: eventCode || '',
          description: description || '',
          milestone: mapEventCodeToMilestone(eventCode),
          remarks: remarks || '',
        });
      }
    }

    // Sort newest first
    events.sort((a, b) => b.timestamp - a.timestamp);

    results[awb] = {
      events,
      error: null,
      shipmentDate: shipmentDate ? new Date(shipmentDate) : null,
      pieces: pieces ? parseInt(pieces) : null,
      weight: weight ? parseFloat(weight) : null,
      weightUnit,
      description: shipmentDesc,
      origin: originCode ? { code: originCode, description: originDesc } : null,
      destination: destCode ? { code: destCode, description: destDesc } : null,
      shipperRef,
      originCountry,
      destCountry,
    };
  }

  return results;
}

// DHL Unified Tracking API (REST - simpler than XML PI)
async function trackViaUnifiedAPI(awb) {
  if (!DHL_UNIFIED_API_KEY) return null;

  try {
    const response = await axios.get(`https://api-eu.dhl.com/track/shipments`, {
      params: { trackingNumber: awb },
      headers: { 'DHL-API-Key': DHL_UNIFIED_API_KEY },
      timeout: 15000,
    });

    const shipments = response.data?.shipments;
    if (!shipments || shipments.length === 0) return null;

    const s = shipments[0];
    const events = (s.events || []).map(e => {
      const code = e.statusCode || '';
      return {
        timestamp: e.timestamp ? new Date(e.timestamp) : null,
        location: e.location?.address?.addressLocality || '',
        locationCode: e.location?.address?.countryCode || '',
        statusCode: code,
        description: e.description || e.status || '',
        milestone: mapEventCodeToMilestone(code),
        remarks: e.remark || '',
      };
    }).filter(e => e.timestamp);

    events.sort((a, b) => b.timestamp - a.timestamp);

    return {
      events,
      error: null,
      shipmentDate: s.details?.proofOfDeliverySignedAt ? new Date(s.details.proofOfDeliverySignedAt) : null,
      pieces: s.details?.totalNumberOfPieces || null,
      weight: s.details?.weight?.value || null,
      weightUnit: s.details?.weight?.unitText || null,
      description: s.details?.description || null,
      origin: s.origin ? { code: s.origin.address?.countryCode, description: s.origin.address?.addressLocality } : null,
      destination: s.destination ? { code: s.destination.address?.countryCode, description: s.destination.address?.addressLocality } : null,
      shipperRef: s.details?.references?.[0]?.number || null,
      originCountry: s.origin?.address?.countryCode || null,
      destCountry: s.destination?.address?.countryCode || null,
      estimatedDelivery: s.estimatedTimeOfDelivery ? new Date(s.estimatedTimeOfDelivery) : null,
    };
  } catch (err) {
    if (err.response?.status === 404) return null; // Not found, try XML PI
    console.error(`[DHL Unified] Track ${awb} error:`, err.response?.data?.detail || err.message);
    return null;
  }
}

async function trackSingleAWB(awb) {
  // Try Unified Tracking API first (REST, simpler, includes estimated delivery)
  const unifiedResult = await trackViaUnifiedAPI(awb);
  if (unifiedResult && unifiedResult.events.length > 0) {
    console.log(`[DHL Unified] AWB ${awb}: ${unifiedResult.events.length} events`);
    return { awb, ...unifiedResult };
  }

  // Fall back to XML PI
  if (!DHL_SITE_ID || !DHL_PASSWORD) {
    return { awb, events: [], error: 'DHL credentials not configured (DHL_SITE_ID / DHL_PASSWORD)' };
  }

  try {
    const xmlBody = buildTrackingXML(awb);
    console.log(`[DHL XML PI] Tracking AWB: ${awb}`);

    const response = await axios.post(DHL_API_URL, xmlBody, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 20000,
      responseType: 'text',
    });

    // Log raw response for debugging
    console.log(`[DHL] Raw response length: ${response.data.length}`);
    console.log(`[DHL] Response preview: ${response.data.substring(0, 500)}`);

    const parsed = parseXMLResponse(response.data);
    const result = parsed[String(awb)];

    console.log(`[DHL] Parsed keys: ${Object.keys(parsed).join(', ') || 'none'}`);

    if (!result) {
      return { awb, events: [], error: 'No tracking data found', rawPreview: response.data.substring(0, 300) };
    }

    console.log(`[DHL] AWB ${awb}: ${result.events.length} events, latest: ${result.events[0]?.description || 'none'}`);
    return { awb, ...result };
  } catch (err) {
    const msg = err.response?.data || err.message || 'Tracking API error';
    console.error(`[DHL] Track AWB ${awb} error:`, typeof msg === 'string' ? msg.substring(0, 200) : msg);
    return { awb, events: [], error: typeof msg === 'string' ? msg.substring(0, 100) : err.message };
  }
}

async function trackBatchAWBs(awbs) {
  const results = {};

  // DHL Unified API rate limit: ~13 req per 5 seconds, resets per minute
  // Throttle to 2/sec to stay under limit, with pause+retry on 429
  let consecutive429 = 0;

  for (const awb of awbs) {
    try {
      const result = await trackViaUnifiedAPI(awb);
      if (result && result.events.length > 0) {
        results[awb] = result;
      } else {
        results[awb] = { events: [], error: 'No tracking data' };
      }
      consecutive429 = 0;
      // Pace at 2 req/sec
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      if (err?.response?.status === 429 || (err?.message || '').includes('429')) {
        consecutive429++;
        if (consecutive429 >= 3) {
          console.log(`[DHL] Rate limited, pausing 65s...`);
          await new Promise(r => setTimeout(r, 65000));
          consecutive429 = 0;
        }
        // Retry this AWB
        try {
          const result = await trackViaUnifiedAPI(awb);
          results[awb] = result && result.events.length > 0 ? result : { events: [], error: 'No data after retry' };
        } catch (retryErr) {
          results[awb] = { events: [], error: retryErr.message };
        }
      } else {
        results[awb] = { events: [], error: err.message };
      }
    }
  }

  return results;
}

// Detect pickup/dispatch event — works with all couriers
// Priority: PU/DP code → 'Picked Up' milestone → description match → first transit event
function findPickupEvent(events) {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 1. Exact status codes (XML PI / UPS)
  const byCode = sorted.find(e => e.statusCode === 'PU' || e.statusCode === 'DP');
  if (byCode) return byCode;

  // 2. Milestone = 'Picked Up'
  const byMilestone = sorted.find(e => e.milestone === 'Picked Up');
  if (byMilestone) return byMilestone;

  // 3. Description text
  const byDesc = sorted.find(e => {
    const d = (e.description || '').toLowerCase();
    return d.includes('picked up') || d.includes('pickup') || d.includes('shipment picked');
  });
  if (byDesc) return byDesc;

  // 4. First transit/movement event (for BlueDart etc. that skip pickup scan)
  //    Skip pre-transit/booked events — find first actual movement
  const firstTransit = sorted.find(e => {
    const code = (e.statusCode || '').toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return (code === 'transit' || e.milestone === 'In Transit') &&
      !desc.includes('booked') && !desc.includes('label') && !desc.includes('billing');
  });
  return firstTransit || null;
}

function computeTrackingStatus(events, shipmentDate, estimatedDelivery, dispatchDate) {
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

  // Calculate transit days from dispatch date (Picked Up), not booked date
  let transitStart = dispatchDate ? new Date(dispatchDate) : null;
  if (!transitStart) {
    const pickupEvent = findPickupEvent(events);
    if (pickupEvent) transitStart = new Date(pickupEvent.timestamp);
  }
  if (transitStart) {
    const endDate = status.isDelivered && status.lastEventTime
      ? status.lastEventTime
      : new Date();
    status.daysInTransit = Math.floor((endDate - transitStart) / (1000 * 60 * 60 * 24));
  }

  // Delayed detection
  if (!status.isDelivered) {
    if (status.daysInTransit > 7) status.isDelayed = true;
    if (status.lastEventTime) {
      const hoursSinceUpdate = (Date.now() - status.lastEventTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate > 48) status.isDelayed = true;
    }
  }

  return status;
}

module.exports = { trackSingleAWB, trackBatchAWBs, trackViaUnifiedAPI, computeTrackingStatus, mapEventCodeToMilestone, findPickupEvent };
