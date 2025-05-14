const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const documentController = require('../controllers/documentController');

// Dashboard
router.get('/', auth, documentController.getDashboard);

// File Upload
router.post('/upload', auth, upload.single('document'), documentController.uploadDocument);

// Share Management
router.get('/share/:id', auth, documentController.showSharePage);
router.post('/share', auth, documentController.handleShare);

// Document Deletion
router.delete('/:id', auth, documentController.deleteDocument);

module.exports = router;