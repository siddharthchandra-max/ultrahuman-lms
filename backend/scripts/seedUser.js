require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await User.findOne({ email: 'admin@ultrahuman.com' });
  if (existing) {
    console.log('Admin user already exists');
  } else {
    await User.create({ email: 'admin@ultrahuman.com', password: 'Ultra@2026', name: 'Ultrahuman Admin', role: 'admin' });
    console.log('Admin user created — admin@ultrahuman.com / Ultra@2026');
  }
  await mongoose.disconnect();
}

seed().catch(console.error);
