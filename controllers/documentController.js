const path = require('path');
const fs = require('fs');
const { db } = require('../config/db');
const { sendShareNotification } = require('../services/emailService');
const logger = require('../config/logger');

exports.getDashboard = async (req, res) => {
  logger.info(`Fetching dashboard for user ID: ${req.user.id}`);
  try {
    const userDocs = await db.query(
      `SELECT id, title, description, file_path, document_type, created_at
       FROM documents WHERE user_id = $1`,
      [req.user.id]
    );

    logger.info(`Successfully fetched ${userDocs.rows.length} documents for user ID: ${req.user.id}`);
    res.render('documents/dashboard', {
      documents: userDocs.rows.map(d => ({ 
        ...d, 
        owner_name: 'You' 
      })),
      user: req.user,
      error: null
    });
  } catch (err) {
    logger.error(`Error fetching dashboard for user ID: ${req.user.id}`, err);
    res.redirect('/');
  }
};

exports.uploadDocument = async (req, res) => {
  logger.info(`Document upload attempt by user ID: ${req.user.id}`);
  try {
    if (!req.file) {
      logger.warn(`No file uploaded by user ID: ${req.user.id}`);
      throw new Error('No file uploaded');
    }
    const { title, description, document_type } = req.body;
    const filePath = `/uploads/${req.file.filename}`;
    logger.debug(`Received upload data: title='${title}', description='${description}', type='${document_type}', filename='${req.file.filename}'`);
    
    await db.query(
      `INSERT INTO documents (user_id, title, description, file_path, document_type)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, title, description, filePath, document_type]
    );
    logger.info(`Document '${title}' uploaded successfully by user ID: ${req.user.id}`);
    
    res.redirect('/documents');
  } catch (err) {
    logger.error(`Error uploading document for user ID: ${req.user.id}`, err);
    try {
      const docsRes = await db.query(
        `SELECT id, title, description, file_path, document_type, created_at
         FROM documents WHERE user_id = $1`,
        [req.user.id]
      );
      res.status(400).render('documents/dashboard', {
        documents: docsRes.rows.map(d => ({ ...d, owner_name: 'You' })),
        error: err.message
      });
      logger.info(`Rendered dashboard with upload error for user ID: ${req.user.id}`);
    } catch (inner) {
      logger.error(`Upload recovery error for user ID: ${req.user.id}`, inner);
      res.redirect('/documents');
    }
  }
};

exports.showSharePage = async (req, res) => {
  const docId = req.params.id;
  logger.info(`Showing share page for document ID: ${docId} to user ID: ${req.user.id}`);
  try {
    const docRes = await db.query(
      `SELECT id, title, description, file_path, document_type, created_at
       FROM documents WHERE id=$1 AND user_id=$2`,
      [docId, req.user.id]
    );
    
    if (!docRes.rows.length) {
      logger.warn(`Share page access denied: Document ID ${docId} not found or not owned by user ID: ${req.user.id}`);
      return res.redirect('/documents');
    }
    const document = docRes.rows[0];
    logger.debug(`Document details fetched for share page: ${document.title}`);
    
    const sharesRes = await db.query(
      `SELECT s.id, s.shared_email, u.email AS shared_with_email
       FROM document_shares s
       JOIN users u ON u.email = s.shared_email
       WHERE s.document_id = $1`,
      [docId]
    );
    logger.debug(`Existing shares fetched for document ID: ${docId}, count: ${sharesRes.rows.length}`);
    
    res.render('documents/share', {
      document,
      shares: sharesRes.rows,
      error: null,
      prevInput: {}
    });
    logger.info(`Share page rendered for document ID: ${docId}`);
  } catch (err) {
    logger.error(`Error showing share page for document ID: ${docId} and user ID: ${req.user.id}`, err);
    res.redirect('/documents');
  }
};

exports.handleShare = async (req, res) => {
  logger.debug('Received request body for handleShare:', req.body);
  try {
    const { document_id, shared_email } = req.body;
    logger.info(`Handling share request for document ID: ${document_id} by user ID: ${req.user.id} to email: ${shared_email}`);
    const userRes = await db.query('SELECT id FROM users WHERE email=$1', [shared_email]);
    if (!userRes.rows.length) {
      logger.warn(`Share failed: User '${shared_email}' not found for document ID: ${document_id}`);
      throw new Error('User not found');
    }
    
    const sharedWithId = userRes.rows[0].id;
    logger.debug(`User '${shared_email}' found with ID: ${sharedWithId}`);
    await db.query(
      `INSERT INTO document_shares (document_id, shared_by, shared_email)
       VALUES ($1,$2,$3)`,
      [document_id, req.user.id, shared_email]
    );
    logger.info(`Document ID: ${document_id} shared successfully by user ID: ${req.user.id} to email: ${shared_email}`);
    
    const docMeta = await db.query('SELECT title, file_path FROM documents WHERE id=$1', [document_id]);
    const absPath = path.join(__dirname, '../public', docMeta.rows[0].file_path);
    
    logger.info(`Sending share notification for document '${docMeta.rows[0].title}' to ${shared_email}`);
    await sendShareNotification(req.user.name, shared_email, docMeta.rows[0].title, absPath);
    res.redirect(`/documents/share/${document_id}`);
  } catch (err) {
    logger.error(`Error handling share for document ID: ${req.body.document_id} by user ID: ${req.user.id} to email: ${req.body.shared_email}`, err);
    try {
      const docRes2 = await db.query(
        'SELECT id, title, description, file_path, document_type, created_at FROM documents WHERE id=$1 AND user_id=$2',
        [document_id, req.user.id]
      );
      
      const shares2 = await db.query(
        `SELECT s.id, s.shared_email, u.email AS shared_with_email
         FROM document_shares s JOIN users u ON u.email=s.shared_email WHERE s.document_id=$1`,
        [document_id]
      );
      logger.info(`Rendered share page with error for document ID: ${document_id}`);
      res.status(400).render('documents/share', {
        document: docRes2.rows[0] || { id: document_id },
        shares: shares2.rows,
        error: err.message,
        prevInput: { shared_email }
      });
    } catch(inner) {
      logger.error(`Share handling recovery error for document ID: ${req.body.document_id}`, inner);
      res.redirect('/documents');
    }
  }
};

exports.deleteDocument = async (req, res) => {
  const docId = req.params.id;
  logger.info(`Document deletion attempt for document ID: ${docId} by user ID: ${req.user.id}`);
  try {
    const docRes = await db.query('SELECT file_path FROM documents WHERE id=$1 AND user_id=$2', [docId, req.user.id]);
    if (!docRes.rows.length) {
      logger.warn(`Document deletion denied: Document ID ${docId} not found or not owned by user ID: ${req.user.id}`);
      return res.redirect('/documents');
    }
    
    const fsPath = path.join(__dirname, '../public', docRes.rows[0].file_path);
    
    fs.unlink(fsPath, err => {
      if (err) {
        logger.error(`Error deleting file from filesystem: ${fsPath}`, err);
      } else {
        logger.info(`File deleted from filesystem: ${fsPath}`);
      }
    });
    
    await db.query('DELETE FROM document_shares WHERE document_id=$1', [docId]);
    logger.info(`Shares deleted for document ID: ${docId}`);
    await db.query('DELETE FROM documents WHERE id=$1', [docId]);
    logger.info(`Document ID: ${docId} deleted from database`);
    
    res.redirect('/documents');
  } catch(err) {
    logger.error(`Error deleting document ID: ${docId} for user ID: ${req.user.id}`, err);
    res.redirect('/documents');
  }
};