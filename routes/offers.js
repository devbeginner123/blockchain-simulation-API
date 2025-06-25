const express = require('express');
const router = express.Router();
const {
  createOffer,
  getMyOffers,
  getOffersForMyRequests,
  getOfferById,
  getOffersByRequestId,
  acceptOffer,
  rejectOffer
} = require('../controllers/offerController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOffer);                 // Buat offer ke suatu request
router.get('/my', protect, getMyOffers);                // Lihat offer yang saya buat
router.get('/incoming', protect, getOffersForMyRequests); // Lihat offer ke request saya
router.get('/by-request/:id', protect, getOffersByRequestId);
router.post('/accept/:offerId', protect, acceptOffer); // Terima offer  
router.post('/reject/:offerId', protect, rejectOffer); // Tolak offer
router.get('/:id', protect, getOfferById);

module.exports = router;
