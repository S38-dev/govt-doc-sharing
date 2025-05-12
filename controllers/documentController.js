const db = require('../config/db');
const path = require('path');

// Upload a new document
exports.uploadDocument = async (req, res) => {
  try {
    const { title, description, document_type } = req.body;
    const filePath = path.join('uploads', req.file.filename);
    await db.query(
      'INSERT INTO documents (user_id, title, description, file_path, document_type) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, title, description, filePath, document_type]
    );
    res.redirect('/documents');
  } catch (error) {
    console.error('Upload document error:', error);
    res.redirect('/documents');
  }
};

// Share an existing document
exports.shareDocument = async (req, res) => {
  try {
    const { document_id, shared_with, permissions, expiry_date = null } = req.body;
    await db.query(
      'INSERT INTO document_shares (document_id, shared_by, shared_with, permissions, expiry_date) VALUES ($1, $2, $3, $4, $5)',
      [document_id, req.user.id, shared_with, permissions, expiry_date]
    );
    res.redirect('/documents');
  } catch (error) {
    console.error('Share document error:', error);
    res.redirect('/documents');
  }
};

// Get document dashboard data
exports.getDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    // Fetch own documents
    const userDocs = await db.query(
      'SELECT d.*, NULL::text as owner_name FROM documents d WHERE d.user_id = $1',
      [userId]
    );
    // Fetch shared documents
    const sharedDocs = await db.query(
      `SELECT d.*, u.name as owner_name
       FROM documents d
       JOIN document_shares ds ON d.id = ds.document_id
       JOIN users u ON d.user_id = u.id
       WHERE ds.shared_with = $1`,
      [userId]
    );
    res.render('documents/index', {
      documents: [
        ...userDocs.rows.map(doc => ({ ...doc, owner_name: 'You' })),
        ...sharedDocs.rows
      ]
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.redirect('/login');
  }
};

// Delete a document and its related records
exports.deleteDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    // Verify ownership
    const docRes = await db.query(
      'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.user.id]
    );
    if (docRes.rows.length === 0) {
      return res.status(404).redirect('/documents');
    }
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
};
