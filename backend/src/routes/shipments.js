const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Shipment = require('../models/Shipment');
const { auth } = require('../middleware/auth');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/shipments — paginated list
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, product, destCode, month, status, sortBy = 'shipmentDate', sortOrder = -1 } = req.query;
    const match = {};
    if (search) {
      match.$or = [
        { awb: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { shipmentNumber: { $regex: search, $options: 'i' } },
        { receiverName: { $regex: search, $options: 'i' } },
      ];
    }
    if (product) match.productName = product;
    if (destCode) match.destCode = destCode;
    if (month) match.month = month;
    if (status) match.status = status;

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

      if (!doc.awb) {
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

      // Derive fields
      if (doc.shipmentDate) {
        const d = new Date(doc.shipmentDate);
        doc.month = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        doc.week = 'W' + Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
