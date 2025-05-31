const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');
const otpStore = require('../services/otpStore');
const logger = require('../config/logger');

exports.register = async (req, res) => {
  logger.info('Registration attempt started');
    try {
      const { name, email, password, aadhaar_number } = req.body;
      logger.debug('Received registration data:', { name, email, aadhaar_number });
  
      // Validate Aadhaar
      if (!/^\d{12}$/.test(aadhaar_number)) {
        logger.warn('Aadhaar validation failed for email:', email);
        return res.render('auth/register', {
          error: 'Invalid Aadhaar number (12 digits required)',
          prevInput: req.body
        });
      }
  
      logger.info('Checking for existing user with email or aadhaar number');
      const exists = await db.query(
        'SELECT id FROM users WHERE email = $1 OR aadhaar_number = $2',
        [email, aadhaar_number]
      );
  
      if (exists.rows.length > 0) {
        logger.warn('User already exists with email or aadhaar number:', email);
        return res.render('auth/register', {
          error: 'User already exists',
          prevInput: req.body
        });
      }
  
      logger.info('Hashing password');
      const hashedPassword = await bcrypt.hash(password, 10);
  
      logger.info('Creating new user');
      const result = await db.query(
        `INSERT INTO users (name, email, password, aadhaar_number)
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [name, email, hashedPassword, aadhaar_number]
      );
      logger.info(`User created with ID: ${result.rows[0].id}`);
  
      const token = jwt.sign(
        { userId: result.rows[0].id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
  
      logger.info('Registration successful, redirecting to documents');
      res.redirect('/documents');
  
    } catch (error) {
      logger.error('Registration error for email:', email, error);
      res.status(500).render('auth/register', {
        error: 'Registration failed. Please try again.',
        prevInput: req.body || {}
      });
    }
};

exports.login = async (req, res) => {
  logger.info('Login attempt started');
  try {
     const { email, password } = req.body;
     logger.debug('Received login data for email:', email);
 
     const userResult = await db.query(
       'SELECT * FROM users WHERE email = $1',
       [email]
     );
 
     if (userResult.rows.length === 0) {
       logger.warn('Login failed: User not found for email:', email);
       return res.render('auth/login', {
         error: 'Invalid credentials',
         prevInput: { email }
       });
     }
 
     const user = userResult.rows[0];
 
     const validPassword = await bcrypt.compare(password, user.password);
     if (!validPassword) {
       logger.warn('Login failed: Incorrect password for email:', email);
       return res.render('auth/login', {
         error: 'Invalid credentials',
         prevInput: { email }
       });
     }
 
     const token = jwt.sign(
       { userId: user.id },
       process.env.JWT_SECRET,
       { expiresIn: '24h' }
     );
 
     res.cookie('jwt', token, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production'
     });
 
     logger.info('Login successful for email:', email, 'redirecting to documents');
     res.redirect('/documents');
     
   } catch (error) {
     logger.error('Login error for email:', req.body.email, error);
     res.render('auth/login', {
       error: 'Login failed. Please try again.',
       prevInput: req.body || {}
     });
   }
};
exports.forgotPassword = async (req, res) => {
  logger.info('Forgot password attempt started');
  try {
    const { email } = req.body;
    logger.debug('Received forgot password request for email:', email);
    
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user.rows.length) {
      logger.warn('Forgot password failed: No account found for email:', email);
      return res.render('auth/forgot-password', {
        error: 'No account found with that email',
        prevInput: { email }
      });
    }

    logger.info('Generating OTP for email:', email);
    const otp = otpStore.generateOTP(email);
    
    logger.info('Sending OTP email to:', email);
    await sendOTPEmail(email, otp);

    logger.info('OTP sent successfully for email:', email);
    res.render('auth/reset-password', {
      email,
      error: null,
      success: 'OTP sent to your email!'
    });
    
  } catch (error) {
    logger.error('Forgot password error for email:', req.body.email, error);
    res.render('auth/forgot-password', {
      error: 'Failed to process request. Please try again.',
      prevInput: req.body
    });
  }
};

exports.resetPassword = async (req, res) => {
  logger.info('Reset password attempt started');
  try {
    const { email, otp, password, confirmPassword } = req.body;
    logger.debug('Received reset password data for email:', email);

    // 1. Validate inputs
    if (password !== confirmPassword) {
      logger.warn('Reset password failed: Passwords do not match for email:', email);
      return res.render('auth/reset-password', {
        email,
        error: 'Passwords do not match',
        success: null
      });
    }

    // 2. Verify OTP
    if (!otpStore.verifyOTP(email, otp)) {
      logger.warn('Reset password failed: Invalid or expired OTP for email:', email);
      return res.render('auth/reset-password', {
        email,
        error: 'Invalid or expired OTP',
        success: null
      });
    }

    // 3. Hash new password
    logger.info('Hashing new password for email:', email);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update password in database
    logger.info('Updating password in database for email:', email);
    await db.query('UPDATE users SET password = $1 WHERE email = $2', [
      hashedPassword,
      email
    ]);

    // 5. Clear OTP
    logger.info('Clearing OTP for email:', email);
    otpStore.cleanup();

    logger.info('Password reset successfully for email:', email);
    res.render('auth/login', {
      success: 'Password updated successfully! Please login',
      error: null,
      prevInput: { email }
    });

  } catch (error) {
    logger.error('Reset password error for email:', req.body.email, error);
    res.render('auth/reset-password', {
      error: 'Failed to reset password. Please try again.',
      prevInput: req.body
    });
  }
};

exports.logout = (req, res) => {
  logger.info('Logout attempt for user:', req.user ? req.user.email : 'unknown');
  res.clearCookie('jwt');
  logger.info('User logged out, redirecting to login');
  res.redirect('/login');
};