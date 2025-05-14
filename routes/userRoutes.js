const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

// Profile Management
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);

// Password Management
router.get('/change-password', auth, userController.initiatePasswordChange);
router.put('/change-password', auth, userController.changePassword);

// OTP Handling
router.get('/verify-otp', auth, userController.showOTPVerification);
router.post('/verify-otp', auth, userController.verifyOTP);
router.post('/send-otp', auth, userController.sendOTP);

// Activity Tracking
router.get('/audit-logs', auth, userController.getAuditLogs);
router.get('/shared-documents', auth, userController.getSharedDocuments);

module.exports = router;