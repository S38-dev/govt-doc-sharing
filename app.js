require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { db, connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse form bodies & cookies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Serve uploads and static assets
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mount auth and user routes first
app.use('/', authRoutes);
app.use('/users', userRoutes);

// **Home page**, no auth required
app.get('/', (req, res) => {
  // If you have req.user from a cookie-parser/jwt middleware, you can pass it;
  // otherwise, just render home and let the nav detect login via cookie.
  res.render('home', { user: req.user || null });
});

// Mount all document routes under /documents
app.use('/documents', documentRoutes);

// General 500 handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://***REMOVED***:${PORT}`);
    });
  })
  .catch(err => {
    console.error('🔥 Failed to start server:', err);
    process.exit(1);
  });
