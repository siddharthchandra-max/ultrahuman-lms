const mongoose = require('mongoose');

const rateCardSchema = new mongoose.Schema({
  courier: { type: String, required: true, index: true }, // DHL, UPS, BlueDart, FedEx
  businessType: { type: String, enum: ['B2C', 'B2B', 'All'], default: 'All', index: true },
  chargeType: { type: String, enum: ['Express Export', 'Express Import', 'Domestic'], default: 'Express Export' },
  zone: { type: String, required: true, index: true }, // Zone 1, Zone 2, ... Zone 12
  weightSlabs: [{
    minWeight: { type: Number, required: true },
    maxWeight: { type: Number, required: true },
    rate: { type: Number, required: true },
    unit: { type: String, default: 'per kg' }, // per kg, flat, per 0.5kg
  }],
  fuelSurchargePercent: { type: Number, default: 0 },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

rateCardSchema.index({ courier: 1, zone: 1, businessType: 1, isActive: 1 });

module.exports = mongoose.model('RateCard', rateCardSchema);
