const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

router.get('/login', (req, res) => {
  res.render('auth/login');
});

// GET /register
router.get('/register', (req, res) => {
  res.render('auth/register', { 
    error: null,
    prevInput: {
      name: '',
      email: '',
      aadhaar_number: ''
    } 
  });
});

// POST /register (update error handler)
router.post('/register', async (req, res) => {
  console.log('Registration attempt started');
  try {
    const { name, email, password, aadhaar_number } = req.body;
    console.log('Received data:', { name, email, aadhaar_number });

    // Validate Aadhaar
    if (!/^\d{12}$/.test(aadhaar_number)) {
      console.log('Aadhaar validation failed');
      return res.render('auth/register', {
        error: 'Invalid Aadhaar number (12 digits required)',
        prevInput: req.body
      });
    }

    // Check existing user
    console.log('Checking existing user...');
    const exists = await db.query(
      'SELECT id FROM users WHERE email = $1 OR aadhaar_number = $2',
      [email, aadhaar_number]
    );

    if (exists.rows.length > 0) {
      console.log('User already exists');
      return res.render('auth/register', {
        error: 'User already exists',
        prevInput: req.body
      });
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log('Creating user...');
    const result = await db.query(
      `INSERT INTO users (name, email, password, aadhaar_number)
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [name, email, hashedPassword, aadhaar_number]
    );
    console.log('User created:', result.rows[0].id);

    // Generate JWT
    const token = jwt.sign(
      { userId: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    console.log('Registration successful, redirecting...');
    res.redirect('/documents');

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).render('auth/register', {
      error: 'Registration failed. Please try again.',
      prevInput: req.body || {}
    });
  }
});
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.render('auth/login', {
        error: 'Invalid credentials',
        prevInput: { email }
      });
    }

    const user = userResult.rows[0];

    // 2. Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('auth/login', {
        error: 'Invalid credentials',
        prevInput: { email }
      });
    }

    // 3. Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 4. Set cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    res.redirect('/documents');
    
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      error: 'Login failed. Please try again.',
      prevInput: req.body || {}
    });
  }
});
// routes/authRoutes.js
router.get('/logout', (req, res) => {
  res.clearCookie('jwt');
  res.redirect('/');
});
module.exports = router;