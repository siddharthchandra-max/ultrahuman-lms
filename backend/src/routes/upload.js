const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Shipment = require('../models/Shipment');
const Invoice = require('../models/Invoice');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(Math.floor(Number(val)));
  if (s.length === 8) return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function getWeek(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - jan1) / 86400000);
  return `W${String(Math.ceil((days + jan1.getDay() + 1) / 7)).padStart(2, '0')}`;
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function str(v) { return v == null ? '' : String(v).trim(); }

// POST /api/upload/dhl — upload DHL billing file
router.post('/dhl', auth, adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'Month label required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = req.body.sheet || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const awbCol = rows[0]?.hasOwnProperty('AWB') ? 'AWB' : (rows[0]?.hasOwnProperty('AWBs') ? 'AWBs' : null);
    const docs = [];
    const invoiceMap = {};

    for (const row of rows) {
      const awb = str(awbCol ? row[awbCol] : row['Shipment Number']);
      const invoiceNum = str(row['Invoice Number']);
      const shipDate = parseDate(row['Shipment Date']);

      const doc = {
        awb: awb ? String(Math.floor(Number(awb)) || awb) : '',
        invoiceNumber: invoiceNum,
        shipmentNumber: str(row['Shipment Number']),
        shipmentDate: shipDate,
        week: getWeek(shipDate),
        month,
        product: str(row['Product']),
        productName: str(row['Product Name']),
        originCode: str(row['Orig Country Code']),
        originName: str(row['Orig Country Name']),
        destCode: str(row['Dest Country Code']),
        destName: str(row['Dest Country Name']),
        senderName: str(row['Senders Name']),
        receiverName: str(row['Receivers Name']),
        receiverCity: str(row['Receivers City']),
        receiverCountry: str(row['Receivers Country']),
        weight: num(row['Weight (kg)']),
        pieces: num(row['Pieces']),
        currency: str(row['Currency']) || 'INR',
        totalExclVAT: num(row['Total amount (excl. VAT)']),
        totalInclVAT: num(row['Total amount (incl. VAT)']),
        totalTax: num(row['Total Tax']),
        weightCharge: num(row['Weight Charge']),
        fuelSurcharge: num(row['FUEL SURCHARGE']),
        importExportDuties: num(row['IMPORT EXPORT DUTIES']),
        importExportTaxes: num(row['IMPORT EXPORT TAXES']),
        clearanceProcessing: num(row['CLEARANCE PROCESSING']),
        dutyTaxPaid: num(row['DUTY TAX PAID']),
        totalExtraCharges: num(row['Total Extra Charges (XC)']),
        remoteAreaDelivery: num(row['REMOTE AREA DELIVERY']),
        merchandiseProcess: num(row['MERCHANDISE PROCESS']),
        bondedStorage: num(row['BONDED STORAGE']),
        addressCorrection: num(row['ADDRESS CORRECTION']),
        goGreenCarbon: num(row['GOGREEN PLUS - CARBON REDUCED']),
        regulatoryCharges: num(row['REGULATORY CHARGES']),
        insuranceCharge: num(row['INSURANCE']),
        shipmentType: str(row['B2C/B2B']) || 'Unknown',
        logisticsType: str(row['Inport Eport']) || 'Export',
        billingAccount: str(row['Billing Account']),
        status: 'Delivered',
        courier: 'DHL',
        sourceFile: req.file.originalname,
      };
      docs.push(doc);

      if (invoiceNum && !invoiceMap[invoiceNum]) {
        invoiceMap[invoiceNum] = {
          invoiceNumber: invoiceNum,
          invoiceDate: parseDate(row['Invoice Date']),
          dueDate: parseDate(row['Due Date']),
          billingAccount: str(row['Billing Account']),
          billingAccountName: str(row['Billing Account Name']),
          stationCode: str(row['Station Code']),
          currency: str(row['Currency']) || 'INR',
          totalExclVAT: 0, totalInclVAT: 0, totalTax: 0, shipmentCount: 0,
          month, sourceFile: req.file.originalname, status: 'Pending',
        };
      }
      if (invoiceNum && invoiceMap[invoiceNum]) {
        invoiceMap[invoiceNum].totalExclVAT += doc.totalExclVAT;
        invoiceMap[invoiceNum].totalInclVAT += doc.totalInclVAT;
        invoiceMap[invoiceNum].totalTax += doc.totalTax;
        invoiceMap[invoiceNum].shipmentCount += 1;
      }
    }

    // Insert shipments
    const batchSize = 5000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
      await Shipment.insertMany(docs.slice(i, i + batchSize), { ordered: false });
      inserted += Math.min(batchSize, docs.length - i);
    }

    // Upsert invoices
    const invoices = Object.values(invoiceMap);
    for (const inv of invoices) {
      await Invoice.findOneAndUpdate({ invoiceNumber: inv.invoiceNumber }, inv, { upsert: true });
    }

    res.json({ message: 'Import complete', shipments: inserted, invoices: invoices.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
