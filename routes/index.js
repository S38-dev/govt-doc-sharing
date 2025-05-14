const authRoutes = require('./authRoutes');
const documentRoutes = require('./documentRoutes');
const userRoutes = require('./userRoutes');

module.exports = (app) => {
  app.use('/', authRoutes);
  app.use('/users', userRoutes);
  app.use('/documents', documentRoutes);
};