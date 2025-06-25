const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const blockchainController = require('../controllers/blockchainController');

// === ROUTE YANG SUDAH ADA SEBELUMNYA (TIDAK BERUBAH) ===
// Mencatat transaksi ke blockchain
router.post('/record/:transactionId', protect, blockchainController.recordToBlockchain);

// Lihat langkah-langkah penambangan
router.get('/mining/:transactionId', protect, blockchainController.getMiningSteps);

// Lihat semua block
router.get('/', blockchainController.getBlockchain);

// === ROUTE BARU UNTUK FITUR TAMBAHAN ===
// Mendapatkan block berdasarkan MongoDB ID
router.get('/block/:blockId', protect, blockchainController.getBlockById);

// Mendapatkan block berdasarkan index
router.get('/block/index/:index', protect, blockchainController.getBlockByIndex);

// Validasi blockchain
router.get('/validate', protect, blockchainController.validateBlockchain);

// Alias untuk kompatibilitas (jika diperlukan)
router.get('/chain', blockchainController.getBlockchain); // sama dengan GET /

module.exports = router;