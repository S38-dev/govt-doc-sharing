require('dotenv').config();
const path = require('path'); // Add this line
const express = require('express');
const cookieParser = require('cookie-parser');
const { db, connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = 4000;

// Initialize database first
connectDB().then(() => {
  // Middleware
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static('public'));
  
  // View Engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views')); // Now uses path

  // Routes
  app.use('/', authRoutes);
  app.use('/documents', documentRoutes);
  app.use('/users', userRoutes);

  // Home route
  app.get('/', (req, res) => res.redirect('/documents'));

  // Error handling
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://***REMOVED***:${PORT}`);
  });
}).catch(err => {
  console.error('🔥 Failed to start server:', err);
  process.exit(1);
});