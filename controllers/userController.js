const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');
const logger = require('../config/logger');

exports.getProfile = async (req, res) => {
  logger.info(`Fetching profile for user ID: ${req.user.id}`);
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, aadhaar_number, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!rows.length) {
      logger.warn(`Profile not found for user ID: ${req.user.id}`);
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    logger.info(`Profile fetched successfully for user ID: ${req.user.id}`);
    res.render('users/profile', {
      user: rows[0],
      message: null
    });
  } catch (err) {
    logger.error(`Error fetching profile for user ID: ${req.user.id}`, err);
    res.status(500).render('error', { error: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  logger.info(`Updating profile for user ID: ${req.user.id}`);
  try {
    const { name, email } = req.body;
    logger.debug(`Received profile update data for user ID: ${req.user.id}, name: ${name}, email: ${email}`);

    const { rows: exists } = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );
    
    if (exists.length) {
      logger.warn(`Email '${email}' already in use by another user (user ID: ${req.user.id})`);
      return res.status(400).render('error', { error: 'Email already in use' });
    }
    
    const { rows } = await db.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, aadhaar_number',
      [name, email, req.user.id]
    );
    
    logger.info(`Profile updated successfully for user ID: ${req.user.id}`);
    res.render('profile', { user: rows[0] });
  } catch (err) {
    logger.error(`Error updating profile for user ID: ${req.user.id}`, err);
    res.status(500).render('error', { error: 'Failed to update profile' });
  }
};

exports.initiatePasswordChange = async (req, res) => {
  logger.info(`Initiating password change for user ID: ${req.user.id}`);
  try {
    const { rows } = await db.query(
      'SELECT id, email FROM users WHERE id = $1',
      [req.user.id]
    );
    
    logger.info(`Password change initiation successful for user ID: ${req.user.id}`);
    res.render('users/initiate-password-change', {
      user: rows[0],
      error: null
    });
  } catch (error) {
    logger.error(`Error initiating password change for user ID: ${req.user.id}`, error);
    res.redirect('/users/profile');
  }
};

exports.changePassword = async (req, res) => {
  logger.info(`Password change attempt for user ID: ${req.user.id}`);
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!rows.length) {
      logger.warn(`Password change failed: User not found for ID: ${req.user.id}`);
      return res.status(404).render('error', { error: 'User not found' });
    }
    
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      logger.warn(`Password change failed: Current password incorrect for user ID: ${req.user.id}`);
      return res.status(401).render('error', { error: 'Current password incorrect' });
    }
    
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    
    logger.info(`Password changed successfully for user ID: ${req.user.id}`);
    res.render('profile', { message: 'Password updated successfully' });
  } catch (err) {
    logger.error(`Error changing password for user ID: ${req.user.id}`, err);
    res.status(500).render('error', { error: 'Failed to change password' });
  }
};

exports.showOTPVerification = (req, res) => {
  logger.info(`Showing OTP verification page for user ID: ${req.user.id}`);
  res.render('users/verify-otp', {
    error: null,
    user: req.user
  });
};

exports.verifyOTP = async (req, res) => {
  logger.info(`OTP verification attempt for user ID: ${req.user.id}`);
  const { otp, newPassword } = req.body;
  const storedOtp = req.app.locals.otp;

  try {
    if (!storedOtp || storedOtp.expires < Date.now()) {
      logger.warn(`OTP verification failed: OTP expired or not found for user ID: ${req.user.id}`);
      return res.render('users/verify-otp', {
        error: 'OTP expired. Please request new OTP.'
      });
    }

    if (otp !== storedOtp.code) {
      logger.warn(`OTP verification failed: Invalid OTP for user ID: ${req.user.id}`);
      return res.render('users/verify-otp', {
        error: 'Invalid OTP. Please try again.'
      });
    }

    logger.info(`OTP verified successfully for user ID: ${req.user.id}, hashing new password`);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, storedOtp.userId]);
    delete req.app.locals.otp;
    
    logger.info(`Password successfully changed via OTP for user ID: ${req.user.id}`);
    res.render('users/profile', {
      user: req.user,
      message: 'Password changed successfully!'
    });
  } catch (error) {
    logger.error(`Error during OTP verification and password change for user ID: ${req.user.id}`, error);
    res.render('users/verify-otp', {
      error: 'Password change failed. Please try again.'
    });
  }
};

exports.getAuditLogs = async (req, res) => {
  logger.info(`Fetching audit logs for user ID: ${req.user.id}`);
  try {
    const { rows } = await db.query(
      `SELECT al.*, d.title AS document_title
       FROM audit_logs al
       LEFT JOIN documents d ON al.document_id = d.id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    
    logger.info(`Successfully fetched ${rows.length} audit logs for user ID: ${req.user.id}`);
    res.render('audit-logs', { logs: rows });
  } catch (err) {
    logger.error(`Error fetching audit logs for user ID: ${req.user.id}`, err);
    res.status(500).render('error', { error: 'Failed to retrieve audit logs' });
  }
};

exports.getSharedDocuments = async (req, res) => {
  logger.info(`Fetching shared documents for user ID: ${req.user.id}`);
  try {
    const { rows } = await db.query(
      `SELECT d.*, u.name AS shared_by_name
       FROM documents d
       JOIN document_shares ds ON d.id = ds.document_id
       JOIN users u ON ds.shared_by = u.id
       WHERE ds.shared_email = $1
         AND (ds.expiry_date IS NULL OR ds.expiry_date > NOW())
       ORDER BY ds.created_at DESC`,
      [req.user.email]
    );
    
    logger.info(`Successfully fetched ${rows.length} shared documents for user ID: ${req.user.id}`);
    res.render('shared-documents', { documents: rows });
  } catch (err) {
    logger.error(`Error fetching shared documents for user ID: ${req.user.id}`, err);
    res.status(500).render('error', { error: 'Failed to retrieve shared documents' });
  }
};

exports.sendOTP = async (req, res) => {
  logger.info(`Sending OTP request for user ID: ${req.user.id}`);
  try {
    const { rows } = await db.query(
      'SELECT id, email FROM users WHERE id = $1',
      [req.user.id]
    );
    
    const user = rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 300000;

    req.app.locals.otp = {
      code: otp,
      expires: expiresAt,
      userId: user.id
    };

    await sendOTPEmail(user.email, otp);
    logger.info(`OTP sent to ${user.email} for user ID: ${user.id}`);
    res.redirect('/users/verify-otp');
  } catch (error) {
    logger.error(`Error sending OTP for user ID: ${req.user.id}`, error);
    res.render('users/initiate-password-change', {
      user: req.user,
      error: 'Failed to send OTP. Please try again.'
    });
  }
};