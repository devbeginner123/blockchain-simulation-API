const express = require('express');
const router = express.Router();
const { createRequest, getAllRequests, getRequestById, getMyRequests } = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');

// More specific routes first
router.get('/my', protect, getMyRequests);        // Get user's own requests
router.post('/', protect, createRequest);         // Create new request
router.get('/', protect, getAllRequests);         // Get all requests
router.get('/:id', protect, getRequestById);      // Get request by ID

module.exports = router;