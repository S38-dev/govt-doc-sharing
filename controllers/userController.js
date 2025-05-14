const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');

exports.getProfile = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, aadhaar_number, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!rows.length) return res.status(404).render('error', { error: 'User not found' });
    
    res.render('users/profile', {
      user: rows[0],
      message: null
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).render('error', { error: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const { rows: exists } = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );
    
    if (exists.length) return res.status(400).render('error', { error: 'Email already in use' });
    
    const { rows } = await db.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, aadhaar_number',
      [name, email, req.user.id]
    );
    
    res.render('profile', { user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).render('error', { error: 'Failed to update profile' });
  }
};

exports.initiatePasswordChange = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, email FROM users WHERE id = $1',
      [req.user.id]
    );
    
    res.render('users/initiate-password-change', {
      user: rows[0],
      error: null
    });
  } catch (error) {
    console.error('Password change init error:', error);
    res.redirect('/users/profile');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!rows.length) return res.status(404).render('error', { error: 'User not found' });
    
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) return res.status(401).render('error', { error: 'Current password incorrect' });
    
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    
    res.render('profile', { message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).render('error', { error: 'Failed to change password' });
  }
};

exports.showOTPVerification = (req, res) => {
  res.render('users/verify-otp', {
    error: null,
    user: req.user
  });
};

exports.verifyOTP = async (req, res) => {
  const { otp, newPassword } = req.body;
  const storedOtp = req.app.locals.otp;

  try {
    if (!storedOtp || storedOtp.expires < Date.now()) {
      return res.render('users/verify-otp', {
        error: 'OTP expired. Please request new OTP.'
      });
    }

    if (otp !== storedOtp.code) {
      return res.render('users/verify-otp', {
        error: 'Invalid OTP. Please try again.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, storedOtp.userId]);
    delete req.app.locals.otp;
    
    res.render('users/profile', {
      user: req.user,
      message: 'Password changed successfully!'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.render('users/verify-otp', {
      error: 'Password change failed. Please try again.'
    });
  }
};

exports.getAuditLogs = async (req, res) => {
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
    
    res.render('audit-logs', { logs: rows });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).render('error', { error: 'Failed to retrieve audit logs' });
  }
};

exports.getSharedDocuments = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, u.name AS shared_by_name, ds.permissions, ds.expiry_date
       FROM documents d
       JOIN document_shares ds ON d.id = ds.document_id
       JOIN users u ON ds.shared_by = u.id
       WHERE ds.shared_with = $1
         AND (ds.expiry_date IS NULL OR ds.expiry_date > NOW())
       ORDER BY ds.created_at DESC`,
      [req.user.id]
    );
    
    res.render('shared-documents', { documents: rows });
  } catch (err) {
    console.error('Get shared documents error:', err);
    res.status(500).render('error', { error: 'Failed to retrieve shared documents' });
  }
};

exports.sendOTP = async (req, res) => {
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
    res.redirect('/users/verify-otp');
  } catch (error) {
    console.error('OTP send error:', error);
    res.render('users/initiate-password-change', {
      user: req.user,
      error: 'Failed to send OTP. Please try again.'
    });
  }
};