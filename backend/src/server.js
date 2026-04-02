require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:3000'] : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/recon', require('./routes/recon'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  // Start tracking cron job
  require('./jobs/trackingRefresh').start();
});
