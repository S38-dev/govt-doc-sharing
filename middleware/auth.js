const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const auth = async (req, res, next) => {
  try {
    // 1. Get token from cookie
    const token = req.cookies.jwt;
    
    if (!token) {
      return res.redirect('/login');
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Check if user still exists
    const user = await db.query(
      'SELECT id, email, aadhaar_number FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows.length) {
      res.clearCookie('jwt');
      return res.redirect('/login');
    }

    // 4. Attach user to request
    req.user = user.rows[0];
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.clearCookie('jwt');
    res.redirect('/login');
  }
};

module.exports = auth;