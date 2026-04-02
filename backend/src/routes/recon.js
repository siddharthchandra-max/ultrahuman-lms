const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Shipment = require('../models/Shipment');
const RateCard = require('../models/RateCard');

// GET /api/recon/summary — Main reconciliation summary
router.get('/summary', auth, async (req, res) => {
  try {
    const { courier, month, chargeType, businessType } = req.query;
    const match = {};
    if (courier) match.courier = courier;
    if (month) match.month = month;
    if (chargeType) match.logisticsType = chargeType;
    if (businessType) match.shipmentType = businessType;

    // Total orders and cost
    const totals = await Shipment.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalCostExclGST: { $sum: '$totalExclVAT' },
        totalCostInclGST: { $sum: '$totalInclVAT' },
        totalWeightCharge: { $sum: '$weightCharge' },
        totalFuelSurcharge: { $sum: '$fuelSurcharge' },
        totalExtraCharges: { $sum: '$totalExtraCharges' },
        totalDuties: { $sum: { $add: ['$importExportDuties', '$importExportTaxes'] } },
        avgOrderCost: { $avg: '$totalExclVAT' },
      }},
    ]);

    // Zone mix — shipments by destZone
    const zoneMix = await Shipment.aggregate([
      { $match: match },
      { $group: { _id: '$destZone', count: { $sum: 1 }, totalCost: { $sum: '$totalExclVAT' } } },
      { $sort: { count: -1 } },
    ]);

    // Charge discrepancy — compare actual vs expected
    const rateCards = await RateCard.find({ isActive: true, ...(courier ? { courier } : {}) }).lean();
    const rateMap = {};
    for (const rc of rateCards) {
      const key = `${rc.courier}_${rc.zone}_${rc.businessType}`;
      rateMap[key] = rc;
    }

    // Get shipments for reconciliation
    const shipments = await Shipment.find(match)
      .select('awb destZone weight totalExclVAT weightCharge fuelSurcharge courier shipmentType')
      .lean();

    let matchCount = 0, chargedLessCount = 0, chargedMoreCount = 0, zoneMissingCount = 0, rateMissingCount = 0;
    let matchActual = 0, matchExpected = 0;
    let chargedLessActual = 0, chargedLessExpected = 0;
    let chargedMoreActual = 0, chargedMoreExpected = 0;
    let zoneMissingActual = 0, rateMissingActual = 0;

    for (const s of shipments) {
      const actual = s.totalExclVAT || 0;

      if (!s.destZone) {
        zoneMissingCount++;
        zoneMissingActual += actual;
        continue;
      }

      const bType = s.shipmentType || 'All';
      const key = `${s.courier}_${s.destZone}_${bType}`;
      const keyAll = `${s.courier}_${s.destZone}_All`;
      const rc = rateMap[key] || rateMap[keyAll];

      if (!rc) {
        rateMissingCount++;
        rateMissingActual += actual;
        continue;
      }

      // Calculate expected charge from rate card
      const weight = s.weight || 0;
      let expectedBase = 0;
      const slab = rc.weightSlabs.find(ws => weight >= ws.minWeight && weight <= ws.maxWeight);
      if (slab) {
        if (slab.unit === 'flat') {
          expectedBase = slab.rate;
        } else {
          expectedBase = slab.rate * weight;
        }
      } else if (rc.weightSlabs.length > 0) {
        // Use highest slab
        const highest = rc.weightSlabs[rc.weightSlabs.length - 1];
        expectedBase = highest.rate * weight;
      }

      const fuelPct = rc.fuelSurchargePercent || 0;
      const expected = expectedBase * (1 + fuelPct / 100);
      const diff = actual - expected;
      const tolerance = expected * 0.02; // 2% tolerance

      if (Math.abs(diff) <= tolerance) {
        matchCount++;
        matchActual += actual;
        matchExpected += expected;
      } else if (diff < 0) {
        chargedLessCount++;
        chargedLessActual += actual;
        chargedLessExpected += expected;
      } else {
        chargedMoreCount++;
        chargedMoreActual += actual;
        chargedMoreExpected += expected;
      }
    }

    const totalActual = matchActual + chargedLessActual + chargedMoreActual + zoneMissingActual + rateMissingActual;
    const totalExpected = matchExpected + chargedLessExpected + chargedMoreExpected;
    const discrepancyPct = totalExpected > 0 ? (((totalActual - totalExpected) / totalExpected) * 100).toFixed(1) : 0;

    const commercialSummary = [
      { status: 'Match', count: matchCount, actualCharge: Math.round(matchActual), expectedCharge: Math.round(matchExpected), difference: Math.round(matchActual - matchExpected) },
      { status: 'Charged Less', count: chargedLessCount, actualCharge: Math.round(chargedLessActual), expectedCharge: Math.round(chargedLessExpected), difference: Math.round(chargedLessActual - chargedLessExpected) },
      { status: 'Charged More', count: chargedMoreCount, actualCharge: Math.round(chargedMoreActual), expectedCharge: Math.round(chargedMoreExpected), difference: Math.round(chargedMoreActual - chargedMoreExpected) },
      { status: 'Zone Missing', count: zoneMissingCount, actualCharge: Math.round(zoneMissingActual), expectedCharge: 0, difference: Math.round(zoneMissingActual) },
      { status: 'Rate Missing', count: rateMissingCount, actualCharge: Math.round(rateMissingActual), expectedCharge: 0, difference: Math.round(rateMissingActual) },
    ];

    res.json({
      totals: totals[0] || {},
      discrepancyPct,
      zoneMix,
      commercialSummary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recon/zone-rates — Zone-wise rate card view
router.get('/zone-rates', auth, async (req, res) => {
  try {
    const { courier, businessType } = req.query;
    const match = { isActive: true };
    if (courier) match.courier = courier;
    if (businessType) match.businessType = businessType;
    const rates = await RateCard.find(match).sort({ zone: 1 }).lean();
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recon/rate-cards — Bulk create/update rate cards
router.post('/rate-cards', auth, async (req, res) => {
  try {
    const { rateCards } = req.body;
    if (!rateCards || !Array.isArray(rateCards)) {
      return res.status(400).json({ error: 'rateCards array required' });
    }

    let created = 0, updated = 0;
    for (const rc of rateCards) {
      const existing = await RateCard.findOne({
        courier: rc.courier,
        zone: rc.zone,
        businessType: rc.businessType || 'All',
        isActive: true,
      });

      if (existing) {
        Object.assign(existing, rc);
        await existing.save();
        updated++;
      } else {
        await RateCard.create(rc);
        created++;
      }
    }

    res.json({ created, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recon/surcharges — Services & surcharges summary
router.get('/surcharges', auth, async (req, res) => {
  try {
    const { courier, month } = req.query;
    const match = {};
    if (courier) match.courier = courier;
    if (month) match.month = month;

    const surcharges = await Shipment.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalFuelSurcharge: { $sum: '$fuelSurcharge' },
        totalRemoteArea: { $sum: '$remoteAreaDelivery' },
        totalImportDuties: { $sum: '$importExportDuties' },
        totalImportTaxes: { $sum: '$importExportTaxes' },
        totalClearance: { $sum: '$clearanceProcessing' },
        totalDutyTaxPaid: { $sum: '$dutyTaxPaid' },
        totalMerchandise: { $sum: '$merchandiseProcess' },
        totalBondedStorage: { $sum: '$bondedStorage' },
        totalAddressCorrection: { $sum: '$addressCorrection' },
        totalGoGreen: { $sum: '$goGreenCarbon' },
        totalRegulatory: { $sum: '$regulatoryCharges' },
        totalInsurance: { $sum: '$insuranceCharge' },
        count: { $sum: 1 },
      }},
    ]);

    const data = surcharges[0] || {};
    const services = [
      { name: 'Fuel Surcharge', total: data.totalFuelSurcharge || 0, type: 'Surcharge' },
      { name: 'Remote Area Delivery', total: data.totalRemoteArea || 0, type: 'Surcharge' },
      { name: 'Import/Export Duties', total: data.totalImportDuties || 0, type: 'Duty' },
      { name: 'Import/Export Taxes', total: data.totalImportTaxes || 0, type: 'Tax' },
      { name: 'Clearance Processing', total: data.totalClearance || 0, type: 'Service' },
      { name: 'Duty Tax Paid', total: data.totalDutyTaxPaid || 0, type: 'Duty' },
      { name: 'Merchandise Processing', total: data.totalMerchandise || 0, type: 'Service' },
      { name: 'Bonded Storage', total: data.totalBondedStorage || 0, type: 'Service' },
      { name: 'Address Correction', total: data.totalAddressCorrection || 0, type: 'Surcharge' },
      { name: 'Go Green Carbon', total: data.totalGoGreen || 0, type: 'Surcharge' },
      { name: 'Regulatory Charges', total: data.totalRegulatory || 0, type: 'Regulatory' },
      { name: 'Insurance', total: data.totalInsurance || 0, type: 'Service' },
    ].filter(s => s.total > 0);

    res.json({ services, shipmentCount: data.count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
