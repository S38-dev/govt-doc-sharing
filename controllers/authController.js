const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.register = async (req, res) => {
  try {
    const { name, email, password, aadhaar_number } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.query(
      'INSERT INTO users (name, email, password, aadhaar_number) VALUES ($1, $2, $3, $4)',
      [name, email, hashedPassword, aadhaar_number]
    );
    
    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.redirect('/register');
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (!user.rows[0] || !(await bcrypt.compare(password, user.rows[0].password))) {
      return res.redirect('/auth/login');
    }

    const token = jwt.sign(
      { userId: user.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('jwt', token, { httpOnly: true });
    res.redirect('/documents');
  } catch (error) {
    console.error(error);
    res.redirect('/auth/login');
  }
};