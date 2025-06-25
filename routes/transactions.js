const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { acceptOffer, updateDeliveryStatus, validateTokens,getUserTransactions, getTransactionById } = require('../controllers/transactionController');

// Specific routes first
router.get('/user-transactions', protect, getUserTransactions); // Lihat transaksi saya

// Parameterized routes after
router.post('/accept/:offerId', protect, acceptOffer); // Terima offer dan generate token
router.patch('/:transactionId/status', protect, updateDeliveryStatus); // update status
router.post('/:transactionId/validate', protect, validateTokens); // validasi token
router.get('/:id', protect, getTransactionById);

module.exports = router;

