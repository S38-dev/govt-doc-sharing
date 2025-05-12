const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  changePassword,
  getAuditLogs,
  getSharedDocuments
} = require('../controllers/userController');

// GET /users/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, aadhaar_number, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    res.render('profile', { user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).render('error', { error: 'Failed to get profile' });
  }
});

// PUT /users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const { rows: exists } = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );
    if (exists.length) {
      return res.status(400).render('error', { error: 'Email already in use' });
    }
    const { rows } = await db.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, aadhaar_number',
      [name, email, req.user.id]
    );
    res.render('profile', { user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).render('error', { error: 'Failed to update profile' });
  }
});

// PUT /users/change-password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return res.status(401).render('error', { error: 'Current password incorrect' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hash, req.user.id]
    );
    res.render('profile', { message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).render('error', { error: 'Failed to change password' });
  }
});

// GET /users/audit-logs
router.get('/audit-logs', auth, async (req, res) => {
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
});

// GET /users/shared-documents
router.get('/shared-documents', auth, async (req, res) => {
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
});

module.exports = router;

module.exports = router;