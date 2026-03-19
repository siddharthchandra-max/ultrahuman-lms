const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema({
  timestamp: Date,
  location: String,
  locationCode: String,
  statusCode: String,
  description: String,
  milestone: {
    type: String,
    enum: ['Booked', 'Picked Up', 'In Transit', 'Customs', 'Out for Delivery', 'Delivered', 'Failed', 'Returned'],
  },
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  awb: { type: String, index: true, trim: true },
  invoiceNumber: { type: String, trim: true },
  shipmentNumber: { type: String, trim: true },
  shipmentDate: Date,
  week: String,
  month: { type: String, index: true },
  product: String,
  productName: { type: String, index: true },
  originCode: String,
  originName: String,
  destCode: { type: String, index: true },
  destName: String,
  senderName: String,
  receiverName: String,
  receiverCity: String,
  receiverCountry: String,
  weight: { type: Number, default: 0 },
  pieces: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  totalExclVAT: { type: Number, default: 0 },
  totalInclVAT: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  weightCharge: { type: Number, default: 0 },
  fuelSurcharge: { type: Number, default: 0 },
  importExportDuties: { type: Number, default: 0 },
  importExportTaxes: { type: Number, default: 0 },
  clearanceProcessing: { type: Number, default: 0 },
  dutyTaxPaid: { type: Number, default: 0 },
  totalExtraCharges: { type: Number, default: 0 },
  remoteAreaDelivery: { type: Number, default: 0 },
  merchandiseProcess: { type: Number, default: 0 },
  bondedStorage: { type: Number, default: 0 },
  addressCorrection: { type: Number, default: 0 },
  goGreenCarbon: { type: Number, default: 0 },
  regulatoryCharges: { type: Number, default: 0 },
  insuranceCharge: { type: Number, default: 0 },
  shipmentType: { type: String, default: 'Unknown' },
  logisticsType: { type: String, default: 'Export' },
  billingAccount: String,
  status: {
    type: String,
    enum: ['Booked', 'Picked Up', 'In Transit', 'Customs', 'Out for Delivery', 'Delivered', 'Failed', 'Returned', 'Unknown'],
    default: 'Unknown', index: true,
  },
  courier: { type: String, default: 'DHL' },
  sourceFile: String,

  // Tracking
  trackingEvents: [trackingEventSchema],
  trackingStatus: {
    currentMilestone: String,
    lastEvent: String,
    lastEventTime: Date,
    lastTrackedAt: Date,
    isDelivered: { type: Boolean, default: false },
    isDelayed: { type: Boolean, default: false },
    estimatedDelivery: Date,
    daysInTransit: { type: Number, default: 0 },
  },
}, { timestamps: true });

shipmentSchema.index({ awb: 1, month: 1 });
shipmentSchema.index({ shipmentDate: -1 });
shipmentSchema.index({ 'trackingStatus.isDelivered': 1, 'trackingStatus.lastTrackedAt': 1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
