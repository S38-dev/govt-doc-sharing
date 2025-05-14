require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { db, connectDB } = require('./config/db');
const routes = require('./routes');
const methodOverride = require('method-override');
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(methodOverride('_method'));
// Routes
routes(app);

// Home page
app.get('/', (req, res) => res.render('home', { user: req.user || null }));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Database connection
connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://***REMOVED***:${PORT}`));
  })
  .catch(err => {
    console.error('🔥 Failed to start server:', err);
    process.exit(1);
  });