const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get } = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { authenticateOptional } = require('../middleware/auth');

const router = express.Router();

// List demo credentials (strictly for demo/testing prototype)
router.get('/demo-accounts', (req, res) => {
  res.json({
    notice: 'SAMPLE DEMO ACCOUNTS ONLY - NOT REAL UNIVERSITY SSO',
    accounts: [
      {
        email: 'student@demo.test',
        password: 'Student123!',
        role: 'student',
        display_name: 'Alex Student (Demo)',
        scenario: 'General student (report seats, holds, favourites)'
      },
      {
        email: 'neha@demo.test',
        password: 'Neha123!',
        role: 'student',
        display_name: 'Neha Patel (Solo Hunter)',
        scenario: 'Solo study, short class gap, needs quiet + socket'
      },
      {
        email: 'arjun@demo.test',
        password: 'Arjun123!',
        role: 'student',
        display_name: 'Arjun Sharma (Group Lead)',
        scenario: 'Group project, needs discussion room with board & hold'
      },
      {
        email: 'library@demo.test',
        password: 'Library123!',
        role: 'staff',
        display_name: 'Sarah Librarian (Demo)',
        scenario: 'Library Staff (manage library spaces, review reports, print QR signs)'
      }
    ]
  });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      staff_scope: user.staff_scope
    }
  });
});

// Get current session
router.get('/me', authenticateOptional, (req, res) => {
  if (!req.user || req.user.role === 'guest') {
    return res.json({ user: { role: 'guest', display_name: 'Guest Explorer' } });
  }
  return res.json({ user: req.user });
});

module.exports = router;
