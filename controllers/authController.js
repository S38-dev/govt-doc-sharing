const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');
const otpStore = require('../services/otpStore');
exports.register = async (req, res) => {
  // Existing register logic from authRoutes
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
};

exports.login = async (req, res) => {
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
};
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // 1. Check if user exists
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user.rows.length) {
      return res.render('auth/forgot-password', {
        error: 'No account found with that email',
        prevInput: { email }
      });
    }

    // 2. Generate and store OTP
    const otp = otpStore.generateOTP(email);
    
    // 3. Send OTP email
    await sendOTPEmail(email, otp);

    res.render('auth/reset-password', {
      email,
      error: null,
      success: 'OTP sent to your email!'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('auth/forgot-password', {
      error: 'Failed to process request. Please try again.',
      prevInput: req.body
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    // 1. Validate inputs
    if (password !== confirmPassword) {
      return res.render('auth/reset-password', {
        email,
        error: 'Passwords do not match',
        success: null
      });
    }

    // 2. Verify OTP
    if (!otpStore.verifyOTP(email, otp)) {
      return res.render('auth/reset-password', {
        email,
        error: 'Invalid or expired OTP',
        success: null
      });
    }

    // 3. Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update password in database
    await db.query('UPDATE users SET password = $1 WHERE email = $2', [
      hashedPassword,
      email
    ]);

    // 5. Clear OTP
    otpStore.cleanup();

    res.render('auth/login', {
      success: 'Password updated successfully! Please login',
      error: null,
      prevInput: { email }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.render('auth/reset-password', {
      email: req.body.email,
      error: 'Failed to reset password. Please try again.',
      success: null
    });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('jwt');
  res.redirect('/');
};