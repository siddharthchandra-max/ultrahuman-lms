const axios = require('axios');
const Shipment = require('../models/Shipment');
const { trackSingleAWB, trackBatchAWBs } = require('./upsTracking');
const { computeTrackingStatus } = require('./dhlTracking');

const UPS_CLIENT_ID = process.env.UPS_CLIENT_ID;
const UPS_CLIENT_SECRET = process.env.UPS_CLIENT_SECRET;
const UPS_ACCOUNT = process.env.UPS_ACCOUNT;
const UPS_QV_NAME = process.env.UPS_QV_NAME || 'ULTRAQVD';
const UPS_TOKEN_URL = 'https://onlinetools.ups.com/security/v1/oauth/token';
const UPS_QV_URL = 'https://onlinetools.ups.com/api/quantumview/v1/subscription';

// Reuse token from upsTracking
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const response = await axios.post(UPS_TOKEN_URL, 'grant_type=client_credentials', {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`).toString('base64'),
    },
    timeout: 10000,
  });

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
  return cachedToken;
}

// Fetch shipments from UPS Quantum View
async function fetchUPSShipments(fromDate = null) {
  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET || !UPS_ACCOUNT) {
    console.log('[UPS QV] Credentials not configured, skipping');
    return { imported: 0, updated: 0, errors: [] };
  }

  try {
    const token = await getToken();

    // Try Quantum View subscription (outbound shipments)
    let shipmentData = [];

    try {
      const qvPayload = {
        QuantumViewRequest: {
          Request: {
            TransactionReference: { CustomerContext: 'UH_LMS_QV' },
          },
          SubscriptionRequest: {
            Name: UPS_QV_NAME,
            DateTimeRange: {
              BeginDateTime: fromDate ? fromDate.replace(/-/g, '') + '000000' : getDateStr(30),
              EndDateTime: getDateStr(0),
            },
          },
        },
      };

      console.log(`[UPS QV] Calling QV API with subscription name: ${UPS_QV_NAME}, date range: ${qvPayload.QuantumViewRequest.SubscriptionRequest.DateTimeRange.BeginDateTime} - ${qvPayload.QuantumViewRequest.SubscriptionRequest.DateTimeRange.EndDateTime}`);

      const qvResponse = await axios.post(UPS_QV_URL, qvPayload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'transId': `UH_LMS_QV_${Date.now()}`,
          'transactionSrc': 'UH_LMS',
        },
        timeout: 30000,
      });

      console.log(`[UPS QV] Response status: ${qvResponse.status}, keys: ${JSON.stringify(Object.keys(qvResponse.data || {}))}`);

      const events = qvResponse.data?.QuantumViewResponse?.QuantumViewEvents;
      if (events?.SubscriptionEvents?.SubscriptionFile) {
        const files = Array.isArray(events.SubscriptionEvents.SubscriptionFile)
          ? events.SubscriptionEvents.SubscriptionFile
          : [events.SubscriptionEvents.SubscriptionFile];

        for (const file of files) {
          const origins = file.Origin ? (Array.isArray(file.Origin) ? file.Origin : [file.Origin]) : [];
          const generics = file.Generic ? (Array.isArray(file.Generic) ? file.Generic : [file.Generic]) : [];
          const deliveries = file.Delivery ? (Array.isArray(file.Delivery) ? file.Delivery : [file.Delivery]) : [];
          const manifests = file.Manifest ? (Array.isArray(file.Manifest) ? file.Manifest : [file.Manifest]) : [];
          const exceptions = file.Exception ? (Array.isArray(file.Exception) ? file.Exception : [file.Exception]) : [];

          // Process Origin (outbound shipments)
          for (const origin of origins) {
            const pkgs = origin.Package ? (Array.isArray(origin.Package) ? origin.Package : [origin.Package]) : [];
            for (const pkg of pkgs) {
              shipmentData.push(parseQVPackage(pkg, origin));
            }
          }

          // Process Manifest (pickup scan events)
          for (const manifest of manifests) {
            const pkgs = manifest.Package ? (Array.isArray(manifest.Package) ? manifest.Package : [manifest.Package]) : [];
            for (const pkg of pkgs) {
              shipmentData.push(parseQVPackage(pkg, manifest));
            }
          }

          console.log(`[UPS QV] File events — Origins: ${origins.length}, Manifests: ${manifests.length}, Deliveries: ${deliveries.length}, Generics: ${generics.length}, Exceptions: ${exceptions.length}`);
        }
      } else {
        console.log(`[UPS QV] No SubscriptionFile in response. Full response snippet: ${JSON.stringify(qvResponse.data).substring(0, 500)}`);
      }
      console.log(`[UPS QV] Got ${shipmentData.length} shipments from Quantum View`);
    } catch (qvErr) {
      const errDetail = qvErr.response?.data ? JSON.stringify(qvErr.response.data).substring(0, 500) : qvErr.message;
      console.error(`[UPS QV] Quantum View error — Status: ${qvErr.response?.status || 'N/A'}, Detail: ${errDetail}`);
      console.log('[UPS QV] Falling back to Shipping History...');
      shipmentData = await fetchViaShippingHistory(token, fromDate);
    }

    // If both fail, try tracking all known UPS AWBs to discover new events
    if (shipmentData.length === 0) {
      console.log('[UPS QV] No data from APIs, syncing via tracking existing AWBs');
      return await syncViaTracking();
    }

    // Import shipments into DB
    return await importShipments(shipmentData);
  } catch (err) {
    console.error('[UPS QV] Error:', err.message);
    return { imported: 0, updated: 0, errors: [err.message] };
  }
}

// Fallback: UPS Shipping History API
async function fetchViaShippingHistory(token, fromDate = null) {
  const shipments = [];

  try {
    // UPS Visibility API - get recent shipments by account
    const response = await axios.get(
      `https://onlinetools.ups.com/api/shipments/v2403/search?accountNumber=${UPS_ACCOUNT}&fromDate=${fromDate || getDateISO(30)}&toDate=${getDateISO(0)}&countryCode=IN&shipmentType=outbound&count=50`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'transId': `UH_LMS_HIST_${Date.now()}`,
          'transactionSrc': 'UH_LMS',
        },
        timeout: 20000,
      }
    );

    const results = response.data?.shipments || response.data?.searchResults || [];
    for (const s of results) {
      const awb = s.trackingNumber || s.inquiryNumber || s.shipmentIdentificationNumber;
      if (!awb) continue;

      shipments.push({
        awb,
        courier: 'UPS',
        shipmentDate: s.shipDate ? new Date(s.shipDate) : new Date(),
        sourceCity: s.shipper?.address?.city || '-',
        sourceCountry: s.shipper?.address?.countryCode || 'IN',
        destCity: s.shipTo?.address?.city || '-',
        destCountry: s.shipTo?.address?.countryCode || '-',
        destName: s.shipTo?.address?.country || '-',
        receiverName: s.shipTo?.companyName || s.shipTo?.name || '-',
        weight: s.weight ? parseFloat(s.weight.weight || s.weight) : 0,
        pieces: s.numberOfPackages || s.packageCount || 1,
        status: 'Booked',
      });
    }
    console.log(`[UPS QV] Got ${shipments.length} shipments from Shipping History`);
  } catch (err) {
    console.log(`[UPS QV] Shipping History not available (${err.response?.status || err.message})`);
  }

  return shipments;
}

// Fallback: Sync by tracking all known UPS AWBs and discovering status
async function syncViaTracking() {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const active = await Shipment.find({
    courier: 'UPS',
    'trackingStatus.isDelivered': { $ne: true },
    shipmentDate: { $gte: sixtyDaysAgo },
    awb: { $exists: true, $ne: '' },
  }).select('awb shipmentDate dispatchDate trackingEvents trackingStatus').limit(200);

  if (active.length === 0) {
    console.log('[UPS QV] No active UPS shipments to sync');
    return { imported: 0, updated: 0, errors: [] };
  }

  const awbs = active.map(s => s.awb);
  console.log(`[UPS QV] Syncing ${awbs.length} active UPS shipments via tracking...`);

  const results = await trackBatchAWBs(awbs);
  let updated = 0;

  for (const [awb, data] of Object.entries(results)) {
    if (!data.events || data.events.length === 0) continue;

    const shipment = await Shipment.findOne({ awb }).sort({ shipmentDate: -1 });
    if (!shipment) continue;

    // Merge events
    const existing = new Set(
      (shipment.trackingEvents || []).map(e => `${e.timestamp?.toISOString()}_${e.statusCode}`)
    );
    const newEvents = data.events.filter(
      e => !existing.has(`${e.timestamp?.toISOString()}_${e.statusCode}`)
    );
    shipment.trackingEvents = [...(shipment.trackingEvents || []), ...newEvents]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const ts = computeTrackingStatus(shipment.trackingEvents, shipment.shipmentDate, data.estimatedDelivery, shipment.dispatchDate);
    shipment.trackingStatus = ts;
    shipment.status = ts.currentMilestone;

    // Set dispatch date and week from pickup event
    if (!shipment.dispatchDate) {
      const pickupEvent = shipment.trackingEvents.filter(e => e.statusCode === 'PU' || e.statusCode === 'DP')
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
      if (pickupEvent) {
        shipment.dispatchDate = new Date(pickupEvent.timestamp);
        const startOfYear = new Date(shipment.dispatchDate.getFullYear(), 0, 1);
        shipment.week = 'W' + Math.ceil(((shipment.dispatchDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      }
    }

    // Enrich with tracking data
    if (data.destCountry && !shipment.destCode) shipment.destCode = data.destCountry;
    if (data.originCountry && !shipment.sourceCountry) shipment.sourceCountry = data.originCountry;
    if (data.origin?.description && !shipment.sourceCity) shipment.sourceCity = data.origin.description;
    if (data.destination?.description && !shipment.destCity) shipment.destCity = data.destination.description;
    if (data.weight && !shipment.weight) shipment.weight = data.weight;
    if (data.estimatedDelivery) shipment.edd = data.estimatedDelivery;

    await shipment.save();
    updated++;
  }

  console.log(`[UPS QV] Updated ${updated}/${awbs.length} shipments via tracking`);
  return { imported: 0, updated, errors: [] };
}

// Import parsed shipments into DB
async function importShipments(shipmentData) {
  let imported = 0;
  let updated = 0;
  const errors = [];

  for (const doc of shipmentData) {
    try {
      if (!doc.awb) continue;

      const existing = await Shipment.findOne({ awb: doc.awb });
      if (existing) {
        // Update non-empty fields only
        const updates = {};
        for (const [k, v] of Object.entries(doc)) {
          if (v && v !== '-' && k !== 'awb' && k !== 'status') {
            if (!existing[k] || existing[k] === '-') updates[k] = v;
          }
        }
        if (Object.keys(updates).length > 0) {
          await Shipment.updateOne({ awb: doc.awb }, { $set: updates });
          updated++;
        }
      } else {
        doc.uploadDate = new Date();
        doc.courier = 'UPS';
        if (!doc.status) doc.status = 'Booked';
        await Shipment.create(doc);
        imported++;
      }
    } catch (err) {
      errors.push({ awb: doc.awb, error: err.message });
    }
  }

  // Track newly imported shipments
  if (imported > 0) {
    const newAwbs = shipmentData.filter(s => s.awb).map(s => s.awb);
    trackBatchAWBs(newAwbs).then(async (results) => {
      for (const [awb, data] of Object.entries(results)) {
        if (!data.events || data.events.length === 0) continue;
        const shipment = await Shipment.findOne({ awb });
        if (!shipment) continue;

        shipment.trackingEvents = data.events;
        const ts = computeTrackingStatus(data.events, shipment.shipmentDate, data.estimatedDelivery, shipment.dispatchDate);
        shipment.trackingStatus = ts;
        shipment.status = ts.currentMilestone;

        if (data.estimatedDelivery) shipment.edd = data.estimatedDelivery;
        if (data.destCountry) shipment.destCode = data.destCountry;
        if (data.originCountry) shipment.sourceCountry = data.originCountry;

        const pickupEvent = data.events.filter(e => e.statusCode === 'PU' || e.statusCode === 'DP')
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
        if (pickupEvent) {
          shipment.dispatchDate = new Date(pickupEvent.timestamp);
          const startOfYear = new Date(shipment.dispatchDate.getFullYear(), 0, 1);
          shipment.week = 'W' + Math.ceil(((shipment.dispatchDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        }

        await shipment.save();
      }
      console.log(`[UPS QV] Tracked ${Object.keys(results).length} newly imported shipments`);
    }).catch(err => console.error('[UPS QV] Background tracking error:', err.message));
  }

  console.log(`[UPS QV] Import done: ${imported} new, ${updated} updated, ${errors.length} errors`);
  return { imported, updated, errors };
}

// Parse Quantum View package
function parseQVPackage(pkg, origin) {
  const awb = pkg.TrackingNumber || pkg.PackageTrackingNumber || '';
  const shipDate = origin.ShipDate || origin.Date;

  return {
    awb,
    courier: 'UPS',
    shipmentDate: shipDate ? parseUPSDate(shipDate) : new Date(),
    sourceCity: origin.ShipperCity || origin.City || '-',
    sourceCountry: origin.ShipperCountryCode || origin.CountryCode || 'IN',
    destCity: pkg.ConsigneeCity || '-',
    destCountry: pkg.ConsigneeCountryCode || '-',
    receiverName: pkg.ConsigneeName || '-',
    weight: pkg.Weight ? parseFloat(pkg.Weight.Weight || pkg.Weight) : 0,
    pieces: 1,
    status: 'Booked',
  };
}

// Helper: YYYYMMDD → Date
function parseUPSDate(str) {
  if (!str || str.length < 8) return new Date();
  return new Date(`${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`);
}

// Helper: date string for N days ago (YYYYMMDD)
function getDateStr(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10).replace(/-/g, '') + '000000';
}

// Helper: ISO date for N days ago
function getDateISO(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

module.exports = { fetchUPSShipments };
