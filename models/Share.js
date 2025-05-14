// models/Share.js
const { db } = require('../config/db');

module.exports = {
    create: async ({ document_id, shared_by, shared_with, permissions, expiry_date }) => {
    await db.query(
      `INSERT INTO document_shares 
       (document_id, shared_by, shared_with, permissions, expiry_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        Number(document_id),
        Number(shared_by),
        Number(shared_with),
        permissions,
        expiry_date ? new Date(expiry_date) : null
      ]
    );
  },

  findByDocumentId: async (documentId) => {
    const result = await db.query(
      `SELECT s.id, s.permissions, s.expiry_date, u.email AS shared_with_email
       FROM document_shares s
       JOIN users u ON u.id = s.shared_with
       WHERE s.document_id = $1`,
      [documentId]
    );
    return result.rows;
  },

  deleteByDocumentId: async (documentId) => {
    await db.query(
      'DELETE FROM document_shares WHERE document_id = $1',
      [documentId]
    );
  }
};