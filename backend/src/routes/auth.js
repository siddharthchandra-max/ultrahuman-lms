const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Generate a readable random password
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  return pwd;
}

// Send credentials email
async function sendCredentialsEmail(email, name, password) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"UH-LMS" <noreply@ultrahuman.com>',
    to: email,
    subject: 'Your UH-LMS Account Credentials',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a2e;">Welcome to UH-LMS, ${name}!</h2>
        <p style="color: #555;">Your account has been created. Here are your login credentials:</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
        </div>
        <p style="color: #555; font-size: 13px;">Please change your password after your first login.</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">— UH-LMS | Ultrahuman Logistics Management System</p>
      </div>
    `,
  });
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findOne({ email, isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({
      token: signToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const user = await User.create({ email, password, name, role });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register — self-registration (only @ultrahuman.com)
router.post('/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

    // Only allow @ultrahuman.com emails
    if (!email.toLowerCase().endsWith('@ultrahuman.com')) {
      return res.status(400).json({ error: 'Only @ultrahuman.com email addresses are allowed' });
    }

    // Check if user already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Generate password and create user
    const password = generatePassword();
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name: name.trim(),
      role: 'viewer',
    });

    // Send credentials via email if SMTP is configured
    let emailSent = false;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendCredentialsEmail(user.email, user.name, password);
        emailSent = true;
      } catch (mailErr) {
        console.error('[Register] Email send failed:', mailErr.message);
      }
    }

    if (emailSent) {
      res.status(201).json({
        message: `Account created! Login credentials have been sent to ${user.email}`,
      });
    } else {
      // No SMTP configured or email failed — return password directly
      res.status(201).json({
        message: `Account created! Please save your credentials below.`,
        credentials: { email: user.email, password },
      });
    }
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
