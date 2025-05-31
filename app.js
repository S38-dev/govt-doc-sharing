require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { db, connectDB } = require('./config/db');
const routes = require('./routes');
const methodOverride = require('method-override');
const app = express();
const PORT = process.env.PORT || 4000;
const jwt = require('jsonwebtoken');
const logger = require('./config/logger');
const morgan = require('morgan');

// Morgan for HTTP request logging
app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db.query(
        'SELECT id, email, aadhaar_number FROM users WHERE id = $1',
        [decoded.userId]
      );
      req.user = user.rows[0] || null;
    }
  } catch (err) {
    logger.error('Auth check error:', err);
  }
  next();
});

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(methodOverride('_method'));
routes(app);

app.get('/', (req, res) => logger.info('Home page accessed') && res.render('home'));

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

connectDB()
  .then(() => {
    app.listen(PORT, () => logger.info(` Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
