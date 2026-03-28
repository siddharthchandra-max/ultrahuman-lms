const axios = require('axios');

const UPS_CLIENT_ID = process.env.UPS_CLIENT_ID;
const UPS_CLIENT_SECRET = process.env.UPS_CLIENT_SECRET;
const UPS_TOKEN_URL = 'https://onlinetools.ups.com/security/v1/oauth/token';
const UPS_TRACK_URL = 'https://onlinetools.ups.com/api/track/v1/details';

// Cache token in memory
let cachedToken = null;
let tokenExpiry = 0;

// UPS status type → milestone mapping
const UPS_STATUS_MAP = {
  'M': 'Booked',           // Manifest / billing info received
  'P': 'Picked Up',        // Pickup
  'I': 'In Transit',       // In Transit
  'X': 'Failed',           // Exception
  'D': 'Delivered',        // Delivered
  'RS': 'Returned',        // Returned to Shipper
  'DO': 'Out for Delivery', // Delivered Origin CFS
  'DD': 'Out for Delivery', // Delivered Destination CFS
  'O': 'Out for Delivery',  // Out for Delivery
};

function mapUPSStatus(statusType, statusCode) {
  if (!statusType) return 'In Transit';
  // Check specific codes first
  if (statusCode === 'OT' || statusCode === 'OF') return 'Out for Delivery';
  if (statusCode === 'DL' || statusCode === 'KB') return 'Delivered';
  if (statusCode === 'RS') return 'Returned';
  if (statusCode === 'DP' || statusCode === 'PU') return 'Picked Up';
  // Then check type
  return UPS_STATUS_MAP[statusType] || 'In Transit';
}

async function getUPSToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) {
    throw new Error('UPS credentials not configured');
  }

  const response = await axios.post(UPS_TOKEN_URL, 'grant_type=client_credentials', {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`).toString('base64'),
    },
    timeout: 10000,
  });

  cachedToken = response.data.access_token;
  // Expire 5 minutes before actual expiry to be safe
  tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
  console.log('[UPS] Got new OAuth token');
  return cachedToken;
}

function parseUPSEvents(trackResponse) {
  const events = [];

  const pkg = trackResponse?.trackResponse?.shipment?.[0]?.package?.[0];
  if (!pkg) return { events, error: 'No package data' };

  const activities = pkg.activity || [];

  for (const act of activities) {
    const status = act.status || {};
    const location = act.location?.address || {};
    const dateStr = act.date; // YYYYMMDD
    const timeStr = act.time; // HHmmss

    let timestamp = null;
    if (dateStr) {
      const y = dateStr.substring(0, 4);
      const m = dateStr.substring(4, 6);
      const d = dateStr.substring(6, 8);
      const h = timeStr ? timeStr.substring(0, 2) : '00';
      const min = timeStr ? timeStr.substring(2, 4) : '00';
      const sec = timeStr ? timeStr.substring(4, 6) : '00';
      timestamp = new Date(`${y}-${m}-${d}T${h}:${min}:${sec}`);
    }

    const city = location.city || '';
    const state = location.stateProvince || '';
    const country = location.countryCode || location.country || '';
    const locationStr = [city, state, country].filter(Boolean).join(', ');

    events.push({
      timestamp,
      location: locationStr,
      locationCode: country,
      statusCode: status.code || '',
      description: status.description || '',
      milestone: mapUPSStatus(status.type, status.code),
      remarks: '',
    });
  }

  // Sort newest first
  events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Extract delivery date, weight, etc.
  const deliveryDate = pkg.deliveryDate?.[0]?.date;
  const weight = pkg.weight?.weight;
  const weightUnit = pkg.weight?.unitOfMeasurement?.code;

  // Shipper/receiver info from shipment level
  const shipment = trackResponse?.trackResponse?.shipment?.[0];
  const shipperCountry = shipment?.shipper?.address?.countryCode;
  const destCountry = shipment?.shipTo?.address?.countryCode;
  const shipperCity = shipment?.shipper?.address?.city;
  const destCity = shipment?.shipTo?.address?.city;

  return {
    events,
    error: null,
    weight: weight ? parseFloat(weight) : null,
    weightUnit,
    originCountry: shipperCountry,
    destCountry,
    origin: shipperCity ? { code: shipperCountry, description: shipperCity } : null,
    destination: destCity ? { code: destCountry, description: destCity } : null,
    estimatedDelivery: deliveryDate ? new Date(`${deliveryDate.substring(0,4)}-${deliveryDate.substring(4,6)}-${deliveryDate.substring(6,8)}`) : null,
  };
}

async function trackSingleAWB(awb) {
  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) {
    return { awb, events: [], error: 'UPS credentials not configured' };
  }

  try {
    const token = await getUPSToken();

    const response = await axios.get(`${UPS_TRACK_URL}/${awb}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'transId': `UH_LMS_${Date.now()}`,
        'transactionSrc': 'UH_LMS',
      },
      timeout: 20000,
    });

    const parsed = parseUPSEvents(response.data);
    return { awb, ...parsed };
  } catch (err) {
    const errData = err.response?.data;
    let msg = err.message;
    if (errData?.response?.errors?.[0]?.message) {
      msg = errData.response.errors[0].message;
    }
    return { awb, events: [], error: msg };
  }
}

// Process array in parallel with concurrency limit
async function parallelLimit(items, concurrency, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function trackBatchAWBs(awbs, concurrency = 10) {
  const results = {};

  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) {
    for (const awb of awbs) {
      results[awb] = { events: [], error: 'UPS credentials not configured' };
    }
    return results;
  }

  // Pre-fetch token so all parallel requests share it
  await getUPSToken();

  // Track in parallel with concurrency limit (default 10 at a time)
  const trackResults = await parallelLimit(awbs, concurrency, async (awb) => {
    const result = await trackSingleAWB(awb);
    return { awb, result };
  });

  for (const { awb, result } of trackResults) {
    results[awb] = result;
  }

  return results;
}

module.exports = { trackSingleAWB, trackBatchAWBs };
