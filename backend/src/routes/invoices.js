const express = require('express');
const Invoice = require('../models/Invoice');
const Shipment = require('../models/Shipment');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/invoices
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, month, status } = req.query;
    const match = {};
    if (search) match.invoiceNumber = { $regex: search, $options: 'i' };
    if (month) match.month = month;
    if (status) match.status = status;

    const [invoices, total] = await Promise.all([
      Invoice.find(match).sort({ invoiceDate: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)),
      Invoice.countDocuments(match),
    ]);
    res.json({ invoices, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const [totals, byStatus, byMonth] = await Promise.all([
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: 1 }, totalAmount: { $sum: '$totalInclVAT' } } }]),
      Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalInclVAT' } } }]),
      Invoice.aggregate([{ $group: { _id: '$month', count: { $sum: 1 }, amount: { $sum: '$totalInclVAT' } } }, { $sort: { _id: 1 } }]),
    ]);
    res.json({ totals: totals[0] || { total: 0, totalAmount: 0 }, byStatus, byMonth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:invoiceNumber/shipments
router.get('/:invoiceNumber/shipments', auth, async (req, res) => {
  try {
    const shipments = await Shipment.find({ invoiceNumber: req.params.invoiceNumber }).sort({ shipmentDate: -1 });
    res.json(shipments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id — update status
router.put('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
