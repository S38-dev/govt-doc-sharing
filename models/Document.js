const { db } = require('../config/db');

module.exports = {
  findByUserId: async (userId) => {
    const result = await db.query(
      `SELECT id, title, description, file_path, document_type, created_at
       FROM documents WHERE user_id = $1`,
      [userId]
    );
    return result.rows; // Ensure this returns the array of rows
  },

  findByIdAndUser: async (id, userId) => {
    const result = await db.query(
      `SELECT id, title, file_path FROM documents 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0]; // Return the first row
  },

  findById: async (id) => {
    const result = await db.query(
      'SELECT * FROM documents WHERE id = $1',
      [id]
    );
    return result.rows[0]; // Return the first row
  },

  create: ({ user_id, title, description, file_path, document_type }) => 
    db.query(
      `INSERT INTO documents (user_id, title, description, file_path, document_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, title, description, file_path, document_type]
    ),

  delete: (id) => 
    db.query('DELETE FROM documents WHERE id = $1', [id])
};