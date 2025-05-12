const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { db } = require('../config/db');
const { sendShareNotification } = require('../services/emailService');

// GET /documents — Dashboard
router.get('/', auth, async (req, res) => {
  try {
    const userDocsRes = await db.query(
      'SELECT id, title, description, file_path, document_type, created_at FROM documents WHERE user_id = $1',
      [req.user.id]
    );
    const sharedDocsRes = await db.query(
      `SELECT d.id, d.title, d.description, d.file_path, d.document_type, d.created_at, u.name AS owner_name
       FROM documents d
       JOIN document_shares ds ON ds.document_id = d.id
       JOIN users u ON u.id = d.user_id
       WHERE ds.shared_with = $1`,
      [req.user.id]
    );
    res.render('documents/index', {
      documents: [
        ...userDocsRes.rows.map(d => ({ ...d, owner_name: 'You' })),
        ...sharedDocsRes.rows
      ],
      error: null
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.redirect('/login');
  }
});

// POST /documents/upload — Upload a new document
router.post('/upload', auth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const { title, description, document_type } = req.body;
    const filePath = `/uploads/${req.file.filename}`;
    await db.query(
      `INSERT INTO documents (user_id, title, description, file_path, document_type)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, title, description, filePath, document_type]
    );
    res.redirect('/documents');
  } catch (err) {
    console.error('Upload error:', err);
    const docsRes = await db.query(
      'SELECT id, title, description, file_path, document_type, created_at FROM documents WHERE user_id = $1',
      [req.user.id]
    );
    res.status(400).render('documents/index', {
      documents: docsRes.rows.map(d => ({ ...d, owner_name: 'You' })),
      error: err.message
    });
  }
});

// GET /documents/share/:id — Show share page for a document
router.get('/share/:id', auth, async (req, res) => {
  const documentId = req.params.id;
  try {
    const docRes = await db.query(
      `SELECT id, title, description, file_path, document_type, created_at
       FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, req.user.id]
    );
    if (!docRes.rows.length) return res.redirect('/documents');
    const document = docRes.rows[0];
    const sharesRes = await db.query(
      `SELECT s.id, s.permissions, s.expiry_date, u.email AS shared_with_email
       FROM document_shares s
       JOIN users u ON u.id = s.shared_with
       WHERE s.document_id = $1`,
      [documentId]
    );
    res.render('documents/share', {
      document,
      shares: sharesRes.rows,
      error: null,
      prevInput: {}
    });
  } catch (err) {
    console.error('Share page error:', err);
    res.redirect('/documents');
  }
});

// POST /documents/share — Handle sharing a document
router.post('/share', auth, async (req, res) => {
  const { document_id, shared_with, permissions, expiry_date } = req.body;
  try {
    const userRes = await db.query('SELECT id FROM users WHERE email = $1', [shared_with]);
    if (!userRes.rows.length) throw new Error('User not found');
    const sharedWithId = userRes.rows[0].id;
    await db.query(
      `INSERT INTO document_shares
       (document_id, shared_by, shared_with, permissions, expiry_date)
       VALUES ($1,$2,$3,$4::TEXT[],$5)`,
      [document_id, req.user.id, sharedWithId,
       Array.isArray(permissions) ? permissions : [permissions],
       expiry_date || null]
    );
    const docRes = await db.query('SELECT title, file_path FROM documents WHERE id = $1',[document_id]);
    const absPath = path.join(__dirname, '../public', docRes.rows[0].file_path);
    await sendShareNotification(
      req.user.name,
      shared_with,
      docRes.rows[0].title,
      permissions,
      absPath
    );
    res.redirect(`/documents/share/${document_id}`);
  } catch (err) {
    console.error('Share error:', err);
    try {
      const docRes = await db.query(
        'SELECT id, title, description, file_path, document_type, created_at FROM documents WHERE id = $1 AND user_id = $2',
        [document_id, req.user.id]
      );
      const sharesRes = await db.query(
        `SELECT s.id, s.permissions, s.expiry_date, u.email AS shared_with_email
         FROM document_shares s
         JOIN users u ON u.id = s.shared_with
         WHERE s.document_id = $1`,
        [document_id]
      );
      const document = docRes.rows[0] || { id: document_id };
      res.status(400).render('documents/share', {
        document,
        shares: sharesRes.rows,
        error: err.message,
        prevInput: { shared_with, permissions, expiry_date }
      });
    } catch (inner) {
      console.error('Recovery error:', inner);
      res.redirect('/documents');
    }
  }
});

// DELETE /documents/:id — Delete a document
router.delete('/:id', auth, async (req, res) => {
  const documentId = req.params.id;
  try {
    const docRes = await db.query('SELECT file_path FROM documents WHERE id = $1 AND user_id = $2',[documentId, req.user.id]);
    if (!docRes.rows.length) return res.redirect('/documents');
    const fsPath = path.join(__dirname, '../public', docRes.rows[0].file_path);
    fs.unlink(fsPath, err => err && console.error('FS unlink error:', err));
    await db.query('DELETE FROM document_shares WHERE document_id = $1',[documentId]);
    await db.query('DELETE FROM documents WHERE id = $1',[documentId]);
    res.redirect('/documents');
  } catch (err) {
    console.error('Delete error:', err);
    res.redirect('/documents');
  }
});

module.exports = router;