// routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); // Import the upload middleware
const { db } = require('../config/db');
const { sendShareNotification } = require('../services/emailService'); // Import email service



// Document Dashboard (Protected)
router.get('/documents', auth, async (req, res) => {
  try {
    const userDocuments = await db.query(
      'SELECT * FROM documents WHERE user_id = $1',
      [req.user.id]
    );

    const sharedDocuments = await db.query(
      `SELECT d.*, u.name as owner_name
       FROM documents d
       JOIN document_shares ds ON d.id = ds.document_id
       JOIN users u ON d.user_id = u.id
       WHERE ds.shared_with = $1`,
      [req.user.id]
    );

    res.render('documents/index', { // Assuming you have a view named 'documents/index'
      documents: [
        ...userDocuments.rows.map(d => ({ ...d, owner: 'You' })),
        ...sharedDocuments.rows
      ]
    });
  } catch (error) {
    console.error('Document dashboard error:', error);
    res.redirect('/login'); // Redirect to login on error, or handle as appropriate
  }
});

// Upload Document (Protected)
router.post('/upload', auth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      // IMPORTANT: Handle the case where no file is sent.
      return res.status(400).render('documents/index', {  // use render
        documents: [],
        error: 'No file uploaded. Please select a file to upload.',
        prevInput: req.body
      });
    }

    const { title, description, document_type } = req.body;
    const filePath = `/uploads/${req.file.filename}`; // Store relative path

    await db.query(
      'INSERT INTO documents (user_id, title, description, file_path, document_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, title, description, filePath, document_type]
    );

    res.redirect('/documents'); // Redirect to the documents dashboard
  } catch (error) {
    console.error('Upload document error:', error);
    let message = 'An error occurred during upload.';
    if (error instanceof multer.MulterError) {
      message = 'File upload error: ' + error.message;
    } else if (error.message === 'Invalid file type. Allowed types are pdf, doc, docx, jpg, png.') {
      message = error.message;
    }
    res.status(500).render('documents/index', {  // use render
      documents: [],
      error: message,
      prevInput: req.body
    });
  }
});

// Share Document (Protected)
router.post('/share', auth, async (req, res) => {
  try {
    const { document_id, shared_with, permissions, expiry_date } = req.body;

    const userRes = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [shared_with]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).render('documents/share', { // use render
        document: { id: document_id },
        shares: [],
        error: 'User with this email not found',
        prevInput: req.body
      });
    }

    const sharedWithUserId = userRes.rows[0].id;

    await db.query(
      `INSERT INTO document_shares (document_id, shared_by, shared_with, permissions, expiry_date)
       VALUES ($1, $2, $3, $4::TEXT[], $5)`,
      [document_id, req.user.id, sharedWithUserId, Array.isArray(permissions) ? permissions : [permissions], expiry_date]
    );

    // Get document details for email notification
    const docRes = await db.query(
      'SELECT title, file_path FROM documents WHERE id = $1',
      [document_id]
    );

    // Construct the absolute path to the file
    const absolutePath = path.join(__dirname, '../public', docRes.rows[0].file_path);

    // Send email notification
    try {
      await sendShareNotification(
        req.user.name,
        shared_with,
        docRes.rows[0].title,
        permissions,
        absolutePath
      );
    } catch (e) {
      console.error("Error sending email: ", e); // Log the error
      return res.status(500).render('documents/share', {  // use render
        document: { id: document_id },
        shares: [],
        error: 'Sharing failed. ' + e.message,
        prevInput: req.body
      });
    }

    res.redirect(`/documents/share/${document_id}`);
  } catch (error) {
    console.error('Share error:', error);
    return res.status(500).render('documents/share', {  // use render
      document: { id: req.body.document_id },
      shares: [],
      error: 'Sharing failed. ' + error.message,
      prevInput: req.body
    });
  }
});

// Delete Document (Protected)
router.delete('/:id', auth, async (req, res) => {
  try {
    const documentId = req.params.id;

    const docRes = await db.query(
      'SELECT id, file_path FROM documents WHERE id = $1 AND user_id = $2', // Include file_path
      [documentId, req.user.id]
    );

    if (!docRes.rows.length) {
      return res.status(404).redirect('/documents');
    }
    // Delete the file from the filesystem
    const filePath = path.join(__dirname, '../public', docRes.rows[0].file_path); // Construct full path
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        // Log the error, but continue with database deletion (optional: you might want to fail the whole operation)
      }
    });

    // Delete shares and audit logs
    await db.query('DELETE FROM document_shares WHERE document_id = $1', [documentId]);
    await db.query('DELETE FROM audit_logs WHERE document_id = $1', [documentId]);

    // Delete the document itself
    await db.query('DELETE FROM documents WHERE id = $1', [documentId]);

    res.redirect('/documents');
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).redirect('/documents');
  }
});
// Get documents dashboard
router.get('/', auth, async (req, res) => {
  try {
    // Get user's documents
    const userDocuments = await db.query(
      'SELECT * FROM documents WHERE user_id = $1',
      [req.user.id]
    );

    // Get shared documents
    const sharedDocuments = await db.query(
      `SELECT d.*, u.name as owner_name
       FROM documents d
       JOIN document_shares ds ON d.id = ds.document_id
       JOIN users u ON d.user_id = u.id
       WHERE ds.shared_with = $1`,
      [req.user.id]
    );

    res.render('documents/index', {
      documents: [
        ...userDocuments.rows.map(d => ({ ...d, owner: 'You' })),
        ...sharedDocuments.rows
      ]
    });

  } catch (error) {
    console.error('Document dashboard error:', error);
    res.redirect('/login');
  }
});

router.get('/share/:id', auth, async (req, res) => {
  try {
    const documentId = req.params.id;

    // Verify document ownership
    const docRes = await db.query(
      'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.user.id]
    );

    if (!docRes.rows.length) {
      return res.redirect('/documents');
    }

    // Get existing shares
    const sharesRes = await db.query(
      `SELECT s.*, u.email as shared_with_email
       FROM document_shares s
       JOIN users u ON s.shared_with = u.id
       WHERE document_id = $1`,
      [documentId]
    );

    res.render('documents/share', {
      document: docRes.rows[0],
      shares: sharesRes.rows,
      error: null,
      prevInput: {}
    });

  } catch (error) {
    console.error('Share page error:', error);
    res.redirect('/documents');
  }
});

router.get('/shared/:shareId', auth, async (req, res) => {
  try {
    const share = await db.query(
      `SELECT d.*, ds.permissions
       FROM document_shares ds
       JOIN documents d ON ds.document_id = d.id
       WHERE ds.id = $1 AND ds.shared_with = $2
         AND (ds.expiry_date IS NULL OR ds.expiry_date > NOW())`,
      [req.params.shareId, req.user.id]
    );

    if (!share.rows.length) {
      return res.status(403).send('Access denied or share expired');
    }

    res.render('documents/view', {  // Create a new view for viewing shared documents if needed
      document: share.rows[0]
    });
  } catch (error) {
    console.error('Shared document error:', error);
    res.redirect('/documents');
  }
});

module.exports = router;
