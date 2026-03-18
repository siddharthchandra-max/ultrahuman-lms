const express = require('express');
const Shipment = require('../models/Shipment');
const Invoice = require('../models/Invoice');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Build match filter from query params
function buildMatch(query) {
  const match = {};
  if (query.month) match.month = query.month;
  if (query.product) match.productName = query.product;
  if (query.destCode) match.destCode = query.destCode;
  if (query.status) match.status = query.status;
  if (query.courier) match.courier = query.courier;
  if (query.from || query.to) {
    match.shipmentDate = {};
    if (query.from) match.shipmentDate.$gte = new Date(query.from);
    if (query.to) match.shipmentDate.$lte = new Date(query.to);
  }
  return match;
}

// GET /api/dashboard/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const [totals, byProduct, byCountry, byMonth, byStatus] = await Promise.all([
      Shipment.aggregate([
        { $match: match },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          totalInclVAT: { $sum: '$totalInclVAT' },
          totalExclVAT: { $sum: '$totalExclVAT' },
          totalTax: { $sum: '$totalTax' },
          totalWeight: { $sum: '$weight' },
          avgWeight: { $avg: '$weight' },
        }},
      ]),
      Shipment.aggregate([
        { $match: match },
        { $group: { _id: '$productName', count: { $sum: 1 }, amount: { $sum: '$totalInclVAT' } }},
        { $sort: { count: -1 } },
      ]),
      Shipment.aggregate([
        { $match: match },
        { $group: { _id: { code: '$destCode', name: '$destName' }, count: { $sum: 1 }, amount: { $sum: '$totalInclVAT' }, weight: { $sum: '$weight' } }},
        { $sort: { count: -1 } },
        { $limit: 25 },
      ]),
      Shipment.aggregate([
        { $match: match },
        { $group: { _id: '$month', count: { $sum: 1 }, amount: { $sum: '$totalInclVAT' } }},
        { $sort: { _id: 1 } },
      ]),
      Shipment.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } }},
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      totals: totals[0] || { total: 0, totalInclVAT: 0, totalExclVAT: 0, totalTax: 0, totalWeight: 0, avgWeight: 0 },
      byProduct,
      byCountry: byCountry.map(c => ({ code: c._id.code, name: c._id.name, count: c.count, amount: c.amount, weight: c.weight })),
      byMonth,
      byStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/country-costs
router.get('/country-costs', auth, async (req, res) => {
  try {
    const match = buildMatch(req.query);
    const result = await Shipment.aggregate([
      { $match: match },
      { $group: {
        _id: { code: '$destCode', name: '$destName' },
        count: { $sum: 1 },
        weightCharge: { $sum: '$weightCharge' },
        fuelSurcharge: { $sum: '$fuelSurcharge' },
        importExportDuties: { $sum: '$importExportDuties' },
        importExportTaxes: { $sum: '$importExportTaxes' },
        clearanceProcessing: { $sum: '$clearanceProcessing' },
        dutyTaxPaid: { $sum: '$dutyTaxPaid' },
        totalExtraCharges: { $sum: '$totalExtraCharges' },
        remoteAreaDelivery: { $sum: '$remoteAreaDelivery' },
        merchandiseProcess: { $sum: '$merchandiseProcess' },
        bondedStorage: { $sum: '$bondedStorage' },
        regulatoryCharges: { $sum: '$regulatoryCharges' },
        totalInclVAT: { $sum: '$totalInclVAT' },
        totalExclVAT: { $sum: '$totalExclVAT' },
        totalTax: { $sum: '$totalTax' },
        totalWeight: { $sum: '$weight' },
      }},
      { $sort: { totalInclVAT: -1 } },
    ]);
    res.json(result.map(r => ({ code: r._id.code, name: r._id.name, ...r, _id: undefined })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/duplicates
router.get('/duplicates', auth, async (req, res) => {
  try {
    const match = { productName: req.query.product || 'DUTIES & TAXES' };
    if (req.query.month) match.month = req.query.month;

    const result = await Shipment.aggregate([
      { $match: match },
      { $group: { _id: '$awb', count: { $sum: 1 }, charges: { $push: '$totalInclVAT' }, months: { $push: '$month' } }},
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 500 },
    ]);
    res.json({ total: result.length, duplicates: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/weekly-trend
router.get('/weekly-trend', auth, async (req, res) => {
  try {
    const match = buildMatch(req.query);
    const result = await Shipment.aggregate([
      { $match: match },
      { $group: { _id: '$week', count: { $sum: 1 }, amount: { $sum: '$totalInclVAT' } }},
      { $sort: { _id: 1 } },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
