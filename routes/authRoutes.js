const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', (req, res) => res.render('auth/login'));
router.get('/register', (req, res) => res.render('auth/register', { 
  error: null,
  prevInput: { name: '', email: '', aadhaar_number: '' }
}));

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/forgot-password', (req, res) => res.render('auth/forgot-password', {
  error: null,
  prevInput: { email: '' }
}));
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password', (req, res) => res.render('auth/reset-password'));
router.post('/reset-password', authController.resetPassword);

module.exports = router;
