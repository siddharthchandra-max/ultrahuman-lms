const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, index: true, trim: true },
  invoiceDate: Date,
  dueDate: Date,
  billingAccount: String,
  billingAccountName: String,
  stationCode: String,
  currency: { type: String, default: 'INR' },
  totalExclVAT: { type: Number, default: 0 },
  totalInclVAT: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  shipmentCount: { type: Number, default: 0 },
  month: String,
  status: { type: String, enum: ['Pending', 'Verified', 'Disputed', 'Paid'], default: 'Pending' },
  sourceFile: String,
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
