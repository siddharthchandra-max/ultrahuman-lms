const express = require('express');
const Shipment = require('../models/Shipment');
const { auth } = require('../middleware/auth');
const router = express.Router();

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

module.exports = router;
