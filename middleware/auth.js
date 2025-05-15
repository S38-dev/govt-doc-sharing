const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await db.query(
      'SELECT id, email, aadhaar_number FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows.length) {
      res.clearCookie('jwt');
      return res.redirect('/login');
    }

    req.user = user.rows[0];
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.clearCookie('jwt');
    res.redirect('/login');
  }
};

module.exports = auth;