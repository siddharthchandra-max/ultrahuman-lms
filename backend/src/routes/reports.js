const express = require('express');
const Shipment = require('../models/Shipment');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/reports/cost-breakdown
router.get('/cost-breakdown', auth, async (req, res) => {
  try {
    const match = {};
    if (req.query.month) match.month = req.query.month;
    if (req.query.destCode) match.destCode = req.query.destCode;

    const result = await Shipment.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        weightCharge: { $sum: '$weightCharge' },
        fuelSurcharge: { $sum: '$fuelSurcharge' },
        importExportDuties: { $sum: '$importExportDuties' },
        importExportTaxes: { $sum: '$importExportTaxes' },
        clearanceProcessing: { $sum: '$clearanceProcessing' },
        dutyTaxPaid: { $sum: '$dutyTaxPaid' },
        remoteAreaDelivery: { $sum: '$remoteAreaDelivery' },
        merchandiseProcess: { $sum: '$merchandiseProcess' },
        bondedStorage: { $sum: '$bondedStorage' },
        addressCorrection: { $sum: '$addressCorrection' },
        goGreenCarbon: { $sum: '$goGreenCarbon' },
        regulatoryCharges: { $sum: '$regulatoryCharges' },
        insuranceCharge: { $sum: '$insuranceCharge' },
        totalExtraCharges: { $sum: '$totalExtraCharges' },
        totalExclVAT: { $sum: '$totalExclVAT' },
        totalInclVAT: { $sum: '$totalInclVAT' },
        totalTax: { $sum: '$totalTax' },
      }},
    ]);
    res.json(result[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/product-analysis
router.get('/product-analysis', auth, async (req, res) => {
  try {
    const match = {};
    if (req.query.month) match.month = req.query.month;

    const result = await Shipment.aggregate([
      { $match: match },
      { $group: {
        _id: '$productName',
        count: { $sum: 1 },
        totalWeight: { $sum: '$weight' },
        avgWeight: { $avg: '$weight' },
        totalInclVAT: { $sum: '$totalInclVAT' },
        avgCost: { $avg: '$totalInclVAT' },
        countries: { $addToSet: '$destCode' },
      }},
      { $sort: { count: -1 } },
    ]);
    res.json(result.map(r => ({ ...r, countryCount: r.countries?.length || 0, countries: undefined })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/weight-analysis
router.get('/weight-analysis', auth, async (req, res) => {
  try {
    const match = { weight: { $gt: 0 } };
    if (req.query.month) match.month = req.query.month;

    const result = await Shipment.aggregate([
      { $match: match },
      { $bucket: {
        groupBy: '$weight',
        boundaries: [0, 1, 5, 10, 25, 50, 100, 500, 10000],
        default: '10000+',
        output: { count: { $sum: 1 }, totalCost: { $sum: '$totalInclVAT' }, avgCost: { $avg: '$totalInclVAT' } },
      }},
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
