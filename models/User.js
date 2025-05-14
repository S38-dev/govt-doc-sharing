const { db } = require('../config/db');

module.exports = {
  // User by email
  findByEmail: async (email) => {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  // Check if user exists
  exists: async (email, aadhaar) => {
    const result = await db.query(
      'SELECT id FROM users WHERE email = $1 OR aadhaar_number = $2',
      [email, aadhaar]
    );
    return result.rows.length > 0;
  },

  // Create new user
  create: async (userData) => {
    const result = await db.query(
      'INSERT INTO users (name, email, password, aadhaar_number) VALUES ($1, $2, $3, $4) RETURNING id',
      [userData.name, userData.email, userData.password, userData.aadhaar]
    );
    return result.rows[0];
  }
};