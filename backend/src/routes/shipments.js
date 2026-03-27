const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Shipment = require('../models/Shipment');
const { auth } = require('../middleware/auth');
const { trackBatchAWBs: dhlTrackBatch, computeTrackingStatus } = require('../services/dhlTracking');
const { trackBatchAWBs: upsTrackBatch } = require('../services/upsTracking');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/shipments — paginated list
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, product, courier, destCode, month, status, logisticsType, dateFrom, dateTo, sortBy = 'shipmentDate', sortOrder = -1 } = req.query;
    const match = {};
    if (search) {
      match.$or = [
        { awb: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { shipmentNumber: { $regex: search, $options: 'i' } },
        { receiverName: { $regex: search, $options: 'i' } },
        { uhrId: { $regex: search, $options: 'i' } },
      ];
    }
    if (product) match.productName = product;
    if (courier) match.courier = courier;
    if (destCode) match.destCode = destCode;
    if (month) match.month = month;
    if (logisticsType) match.logisticsType = logisticsType;
    if (dateFrom || dateTo) {
      match.shipmentDate = {};
      if (dateFrom) match.shipmentDate.$gte = new Date(dateFrom);
      if (dateTo) match.shipmentDate.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    if (status) {
      if (status.includes(',')) {
        match.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        match.status = status;
      }
    }

    const [shipments, total] = await Promise.all([
      Shipment.find(match)
        .sort({ [sortBy]: Number(sortOrder) })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .select('-__v'),
      Shipment.countDocuments(match),
    ]);

    res.json({
      shipments,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipments/filters — dropdown options
router.get('/filters', auth, async (req, res) => {
  try {
    const [products, countries, months, statuses] = await Promise.all([
      Shipment.distinct('productName'),
      Shipment.aggregate([{ $group: { _id: { code: '$destCode', name: '$destName' } } }, { $sort: { '_id.name': 1 } }]),
      Shipment.distinct('month'),
      Shipment.distinct('status'),
    ]);
    res.json({
      products: products.filter(Boolean).sort(),
      countries: countries.map(c => ({ code: c._id.code, name: c._id.name })).filter(c => c.code),
      months: months.filter(Boolean),
      statuses: statuses.filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipments/lookup/:awb — AWB detail
router.get('/lookup/:awb', auth, async (req, res) => {
  try {
    const shipments = await Shipment.find({ awb: req.params.awb }).sort({ shipmentDate: -1 });
    if (!shipments.length) return res.status(404).json({ error: 'AWB not found' });
    res.json(shipments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shipments/:id — update shipment
router.put('/:id', auth, async (req, res) => {
  try {
    const allowed = ['status', 'shipmentType', 'logisticsType'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const shipment = await Shipment.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    res.json(shipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments — create manual shipment
router.post('/', auth, async (req, res) => {
  try {
    const shipment = await Shipment.create(req.body);
    res.status(201).json(shipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments/bulk-upload — bulk upload from Excel/CSV
router.post('/bulk-upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'No data rows found in file' });

    const colMap = {
      'AWB No.': 'awb', 'Courier Name': 'courier', 'UHR No': 'shipmentNumber',
      'Booked Date': 'shipmentDate', 'Source City': 'sourceCity', 'Source Pincode': 'sourcePincode',
      'Source Zone': 'sourceZone', 'Source State': 'sourceState', 'Source Country': 'sourceCountry',
      'Destination City': 'destCity', 'Destination Pincode': 'destPincode',
      'Destination Zone': 'destZone', 'Destination State': 'destState', 'Destination Country': 'destCountry',
      'Logistics Type': 'logisticsType', 'Shipment Type': 'shipmentType',
      'Movement Type': 'movementType', 'Shipping Method': 'shippingMethod',
      'EDD': 'edd', 'Shipment Weight': 'weight', 'Invoice Number': 'invoiceNumber',
      'Invoice Date': 'invoiceDate', 'Quantity': 'pieces', 'SKU': 'sku',
      'Product Name': 'productName', 'Facility Code': 'facilityCode',
      'Facility Name': 'facilityName', 'Consignee Name': 'receiverName', 'Warehouse': 'warehouse',
    };

    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const shipments = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const doc = { status: 'Booked', uploadDate: new Date() };

      for (const [excelCol, field] of Object.entries(colMap)) {
        if (row[excelCol] !== undefined && row[excelCol] !== '') {
          doc[field] = row[excelCol];
        }
      }

      // Replace empty/whitespace-only string values with '-'
      for (const [k, v] of Object.entries(doc)) {
        if (typeof v === 'string' && v.trim() === '' && k !== 'status') doc[k] = '-';
      }

      if (!doc.awb || doc.awb === '-') {
        errors.push({ row: i + 2, error: 'AWB No. is required' });
        continue;
      }

      // Parse dates
      if (doc.shipmentDate) doc.shipmentDate = parseDate(doc.shipmentDate);
      if (doc.edd) doc.edd = parseDate(doc.edd);
      if (doc.invoiceDate) doc.invoiceDate = parseDate(doc.invoiceDate);

      // Parse numbers
      if (doc.weight) doc.weight = parseFloat(doc.weight) || 0;
      if (doc.pieces) doc.pieces = parseInt(doc.pieces) || 1;

      // Derive month from shipment date
      if (doc.shipmentDate) {
        const d = new Date(doc.shipmentDate);
        doc.month = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      }

      // Map dest fields
      if (doc.destCountry && !doc.destName) doc.destName = doc.destCountry;
      if (doc.destCountry && !doc.destCode) doc.destCode = doc.destCountry;

      shipments.push(doc);
    }

    let inserted = 0;
    let updated = 0;

    for (const doc of shipments) {
      const existing = await Shipment.findOne({ awb: doc.awb });
      if (existing) {
        await Shipment.updateOne({ awb: doc.awb }, { $set: doc });
        updated++;
      } else {
        await Shipment.create(doc);
        inserted++;
      }
    }

    res.json({ success: true, inserted, updated, errors, total: rows.length });

    // Background tracking — group AWBs by courier
    const dhlAwbs = shipments.filter(s => s.courier && s.courier.toLowerCase().includes('dhl')).map(s => s.awb);
    const upsAwbs = shipments.filter(s => s.courier && s.courier.toLowerCase().includes('ups')).map(s => s.awb);

    // Helper to update shipments from tracking results
    const updateFromTracking = async (results, courierName) => {
      for (const [awb, data] of Object.entries(results)) {
        if (data.error || !data.events.length) continue;
        const shipment = await Shipment.findOne({ awb });
        if (!shipment) continue;

        const trackingStatus = computeTrackingStatus(data.events, shipment.shipmentDate, data.estimatedDelivery, shipment.dispatchDate);
        const updateFields = {
          trackingEvents: data.events,
          trackingStatus,
          status: trackingStatus.currentMilestone,
        };

        // Enrich shipment with tracking data if missing (use '-' for blank values)
        const valOrDash = (v) => (typeof v === 'string' && v.trim() === '') ? '-' : v;
        if (data.origin && !shipment.sourceCity) updateFields.sourceCity = valOrDash(data.origin.description) || '-';
        if (data.destination && !shipment.destCity) updateFields.destCity = valOrDash(data.destination.description) || '-';
        if (data.destCountry && !shipment.destCode) updateFields.destCode = valOrDash(data.destCountry) || '-';
        if (data.originCountry && !shipment.sourceCountry) updateFields.sourceCountry = valOrDash(data.originCountry) || '-';
        if (data.weight && !shipment.weight) updateFields.weight = data.weight;
        if (data.pieces && !shipment.pieces) updateFields.pieces = data.pieces;
        if (data.shipperRef && !shipment.shipmentNumber) updateFields.shipmentNumber = valOrDash(data.shipperRef) || '-';
        if (data.description && !shipment.productName) updateFields.productName = valOrDash(data.description) || '-';
        if (data.estimatedDelivery) updateFields.edd = data.estimatedDelivery;

        // Set dispatch date from first Picked Up (PU/DP) event
        const pickupEvent = data.events.filter(e => e.statusCode === 'PU' || e.statusCode === 'DP').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
        if (pickupEvent && pickupEvent.timestamp) {
          const dispDate = new Date(pickupEvent.timestamp);
          updateFields.dispatchDate = dispDate;
          const startOfYear = new Date(dispDate.getFullYear(), 0, 1);
          updateFields.week = 'W' + Math.ceil(((dispDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        }

        await Shipment.updateOne({ awb }, { $set: updateFields });
      }
      console.log(`[${courierName}] Tracked ${Object.keys(results).length} AWBs after bulk upload`);
    };

    // Trigger DHL tracking
    if (dhlAwbs.length > 0) {
      dhlTrackBatch(dhlAwbs).then(r => updateFromTracking(r, 'DHL')).catch(err => {
        console.error('[DHL] Background tracking error:', err.message);
      });
    }

    // Trigger UPS tracking
    if (upsAwbs.length > 0) {
      upsTrackBatch(upsAwbs).then(r => updateFromTracking(r, 'UPS')).catch(err => {
        console.error('[UPS] Background tracking error:', err.message);
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
