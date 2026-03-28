const axios = require('axios');
const Shipment = require('../models/Shipment');

const METABASE_URL = process.env.METABASE_URL || 'https://metabase.ultrahuman.com';
const METABASE_SESSION = process.env.METABASE_SESSION;
const METABASE_QUESTION_ID = process.env.METABASE_QUESTION_ID || '19100';

// Extract AWB from tracking URL
function extractAWB(trackingUrl) {
  if (!trackingUrl) return null;
  const url = trackingUrl.replace(/^"|"$/g, ''); // Remove surrounding quotes

  // DHL: tracking-id=1163247330
  let match = url.match(/tracking-id=(\d+)/i);
  if (match) return match[1];

  // UPS: tracknum=1ZG153F90335056821
  match = url.match(/tracknum=([A-Z0-9]+)/i);
  if (match) return match[1];

  // FedEx: trknbr=870003429979
  match = url.match(/trknbr=(\d+)/i);
  if (match) return match[1];

  // BlueDart: trackNo=21001184665
  match = url.match(/trackNo=(\d+)/i);
  if (match) return match[1];

  // Swiship: id=INTLCMH897395649
  match = url.match(/[?&]id=([A-Z0-9]+)/i);
  if (match) return match[1];

  return null;
}

// Detect courier from tracking URL
function detectCourier(trackingUrl) {
  if (!trackingUrl) return 'Unknown';
  const url = trackingUrl.toLowerCase();
  if (url.includes('dhl.com')) return 'DHL';
  if (url.includes('bluedart')) return 'BlueDart';
  if (url.includes('ups.com')) return 'UPS';
  if (url.includes('fedex.com')) return 'FedEx';
  if (url.includes('swiship')) return 'Swiship';
  return 'Unknown';
}

// Fetch data from Metabase question
async function fetchMetabaseData() {
  if (!METABASE_SESSION) {
    throw new Error('METABASE_SESSION not configured');
  }

  const response = await axios.post(
    `${METABASE_URL}/api/card/${METABASE_QUESTION_ID}/query/json`,
    { parameters: [] },
    {
      headers: {
        'X-Metabase-Session': METABASE_SESSION,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  );

  return response.data;
}

// Determine warehouse — BLR if source or destination is India
function detectWarehouse(sourceCountry, destCountry) {
  const isIndia = (c) => {
    if (!c) return false;
    const v = c.trim().toLowerCase();
    return v === 'india' || v === 'in';
  };
  if (isIndia(sourceCountry) || isIndia(destCountry)) return 'BLR';
  return null;
}

// Map Metabase row to Shipment fields
function mapRowToShipment(row) {
  const trackingUrl = row.RING_TRACKING_URL_TO || '';
  const awb = extractAWB(trackingUrl);
  const courier = detectCourier(trackingUrl);
  const warehouse = detectWarehouse('IN', row.COUNTRY);

  return {
    awb: awb || '',
    uhrId: row.UHR_ID || '',
    customerEmail: row.EMAIL || '',
    customerPhone: row.PHONE || '',
    receiverName: row.NAME || '',
    receiverCity: row.CITY || '',
    receiverCountry: row.COUNTRY || '',
    destCity: row.CITY || '',
    destState: row.PROVINCE || '',
    destPincode: row.ZIP || '',
    destCountry: row.COUNTRY || '',
    destName: row.CITY || '',
    courier,
    shipmentDate: row.SHIPPING_DATE_NEW ? new Date(row.SHIPPING_DATE_NEW) : null,
    orderChannel: row.ORDER_CHANNEL || '',
    orderSource: row.ORDER_SOURCE || '',
    shopifyStore: row.SHOPIFY_STORE || '',
    shopifyOrderId: row.SHOPIFY_ORDER_ID ? String(row.SHOPIFY_ORDER_ID) : '',
    shopifyOrderNumber: row.SHOPIFY_ORDER_NUMBER ? String(row.SHOPIFY_ORDER_NUMBER) : '',
    serialNumber: row.RING_SERIAL_NO_TO || '',
    sku: row.SKU || '',
    invoiceNumber: row.SHIPPING_INVOICE || '',
    amountUSD: row.AMOUNT_USD || null,
    discountUSD: row.DISCOUNT_REV_USD || null,
    taxUSD: row.TAX_USD || null,
    b2cFlag: row.B2C_FLAG || '',
    billingName: row.BILLING_NAME || '',
    billingAddress: [row.billing_address1, row.billing_address2].filter(Boolean).join(', '),
    billingCity: row.billing_city || '',
    billingZip: row.billing_zip || '',
    billingCountry: row.billing_country_code || '',
    omsStatus: row.STATUS_TO || '',
    shipmentType: row.SHIPMENT_TYPE || 'b2c',
    warehouse,
    senderName: 'Ultrahuman',
    sourceCountry: 'IN',
  };
}

// Sync shipments from Metabase into MongoDB
// sinceDate: only import rows shipped on or after this date (default: March 1, 2026)
async function syncFromMetabase(sinceDate = '2026-03-01') {
  console.log(`[Metabase] Starting sync (since ${sinceDate})...`);
  const allRows = await fetchMetabaseData();
  console.log(`[Metabase] Fetched ${allRows.length} total rows from Metabase`);

  // Only import supported couriers: UPS, DHL, BlueDart, FedEx
  const ALLOWED_COURIERS = ['UPS', 'DHL', 'BlueDart', 'FedEx'];
  const cutoff = new Date(sinceDate);
  const rows = allRows.filter(r => {
    const d = r.SHIPPING_DATE_NEW ? new Date(r.SHIPPING_DATE_NEW) : null;
    if (!d || d < cutoff) return false;
    const courier = detectCourier(r.RING_TRACKING_URL_TO);
    return ALLOWED_COURIERS.includes(courier);
  });
  console.log(`[Metabase] ${rows.length} rows after date filter (>= ${sinceDate})`);

  // Pre-load existing UHR IDs and AWBs for fast lookup
  const existingByUhr = {};
  const existingByAwb = {};
  const existing = await Shipment.find(
    { $or: [{ uhrId: { $exists: true, $ne: '' } }, { awb: { $exists: true, $ne: '' } }] },
    { uhrId: 1, awb: 1 }
  ).maxTimeMS(60000).lean();
  for (const s of existing) {
    if (s.uhrId) existingByUhr[s.uhrId] = s._id;
    if (s.awb) existingByAwb[s.awb] = s._id;
  }
  console.log(`[Metabase] Loaded ${existing.length} existing shipments for dedup`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const bulkOps = [];

    for (const row of batch) {
      try {
        const mapped = mapRowToShipment(row);
        if (!mapped.uhrId) { skipped++; continue; }

        // Check if exists
        const existingId = existingByUhr[mapped.uhrId] || (mapped.awb ? existingByAwb[mapped.awb] : null);

        if (existingId) {
          // Update via bulkWrite
          bulkOps.push({
            updateOne: {
              filter: { _id: existingId },
              update: {
                $set: {
                  uhrId: mapped.uhrId,
                  customerEmail: mapped.customerEmail,
                  customerPhone: mapped.customerPhone,
                  receiverName: mapped.receiverName,
                  receiverCity: mapped.receiverCity,
                  receiverCountry: mapped.receiverCountry,
                  destCity: mapped.destCity,
                  destState: mapped.destState,
                  destPincode: mapped.destPincode,
                  destCountry: mapped.destCountry,
                  orderChannel: mapped.orderChannel,
                  orderSource: mapped.orderSource,
                  shopifyStore: mapped.shopifyStore,
                  shopifyOrderId: mapped.shopifyOrderId,
                  shopifyOrderNumber: mapped.shopifyOrderNumber,
                  serialNumber: mapped.serialNumber,
                  sku: mapped.sku,
                  amountUSD: mapped.amountUSD,
                  discountUSD: mapped.discountUSD,
                  taxUSD: mapped.taxUSD,
                  b2cFlag: mapped.b2cFlag,
                  billingName: mapped.billingName,
                  billingAddress: mapped.billingAddress,
                  billingCity: mapped.billingCity,
                  billingZip: mapped.billingZip,
                  billingCountry: mapped.billingCountry,
                  omsStatus: mapped.omsStatus,
                  warehouse: mapped.warehouse,
                  omsSyncedAt: new Date(),
                },
              },
            },
          });
          updated++;
        } else {
          // Calculate week/month
          let month = null, week = null;
          if (mapped.shipmentDate) {
            const d = mapped.shipmentDate;
            month = d.toISOString().substring(0, 7);
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            week = 'W' + Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
          }

          bulkOps.push({
            insertOne: {
              document: {
                ...mapped,
                status: 'Booked',
                month,
                week,
                omsSyncedAt: new Date(),
              },
            },
          });

          // Track in dedup maps
          if (mapped.uhrId) existingByUhr[mapped.uhrId] = 'pending';
          if (mapped.awb) existingByAwb[mapped.awb] = 'pending';
          created++;
        }
      } catch (err) {
        errors++;
        if (errors <= 5) console.error(`[Metabase] Row error (${row.UHR_ID}):`, err.message);
      }
    }

    // Execute batch
    if (bulkOps.length > 0) {
      try {
        await Shipment.bulkWrite(bulkOps, { ordered: false });
      } catch (err) {
        console.error(`[Metabase] Bulk write error:`, err.message);
        errors += bulkOps.length;
      }
    }

    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`[Metabase] Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
  }

  const result = { total: rows.length, created, updated, skipped, errors };
  console.log(`[Metabase] Sync complete:`, result);
  return result;
}

module.exports = { syncFromMetabase, fetchMetabaseData, extractAWB, detectCourier };
