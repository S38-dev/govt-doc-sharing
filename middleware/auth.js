const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const logger = require('../config/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      logger.warn('Authentication failed: No JWT token found in cookies');
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.debug(`JWT token decoded for user ID: ${decoded.userId}`);
    
    const user = await db.query(
      'SELECT id, email, aadhaar_number FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user.rows.length) {
      logger.warn(`Authentication failed: User with ID ${decoded.userId} not found in database`);
      res.clearCookie('jwt');
      return res.redirect('/login');
    }

    req.user = user.rows[0];
    logger.info(`User authenticated: ${req.user.email} (ID: ${req.user.id})`);
    next();
  } catch (err) {
    logger.error('Authentication error:', err);
    res.clearCookie('jwt');
    res.redirect('/login');
  }
};

module.exports = auth;