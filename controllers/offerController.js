const Offer = require('../models/Offer');
const Request = require('../models/Request');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

console.log('[DEBUG] Transaction model imported:', typeof Transaction);
console.log('[DEBUG] Transaction model methods:', Object.keys(Transaction));

const generateUniqueToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Buat tawaran ke request tertentu
exports.createOffer = async (req, res) => {
  const { requestId, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Minimal satu item harus ditawarkan" });
  }

  try {
    const relatedRequest = await Request.findById(requestId);
    if (!relatedRequest) {
      return res.status(404).json({ message: "Request tidak ditemukan" });
    }

    // Validasi jumlah item
    if (relatedRequest.items.length !== items.length) {
      return res.status(400).json({ message: "Jumlah item dalam offer harus sesuai dengan request" });
    }

    const newOffer = await Offer.create({
      request: requestId,
      user: req.user._id,
      items
    });

    res.status(201).json(newOffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Lihat semua offer dari user login
exports.getMyOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ user: req.user._id })
      .populate('request', 'deadline')
      .populate('user', 'name email');

    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Lihat semua offer terhadap request milik user login
exports.getOffersForMyRequests = async (req, res) => {
  try {
    const myRequests = await Request.find({ user: req.user._id }).select('_id');
    const requestIds = myRequests.map(req => req._id);

    const offers = await Offer.find({ request: { $in: requestIds } })
      .populate('request')
      .populate('user', 'name email');

    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.acceptOffer = async (req, res) => {
  const { offerId } = req.params;

  try {
    console.log(`[DEBUG] Accepting offer: ${offerId}`);
    
    // Cari offer yang ingin diterima
    const selectedOffer = await Offer.findById(offerId).populate('request');
    if (!selectedOffer) {
      return res.status(404).json({ message: "Offer tidak ditemukan" });
    }

    console.log(`[DEBUG] Found offer:`, {
      offerId: selectedOffer._id,
      requestId: selectedOffer.request._id,
      requestUserId: selectedOffer.request.user,
      currentUserId: req.user._id,
      items: selectedOffer.items,
      itemsLength: selectedOffer.items?.length,
      itemsType: typeof selectedOffer.items,
      isArray: Array.isArray(selectedOffer.items)
    });

    // Cek apakah request milik user yang login
    if (selectedOffer.request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Tidak diizinkan menerima offer untuk request ini" });
    }

    const requestId = selectedOffer.request._id;

    console.log(`[DEBUG] Updating other offers to rejected for request: ${requestId}`);

    // Update semua offer dari request tersebut jadi rejected
    await Offer.updateMany(
      { request: requestId, _id: { $ne: offerId } },
      { $set: { status: 'rejected' } }
    );

    // Update offer yang diterima jadi accepted
    selectedOffer.status = 'accepted';
    await selectedOffer.save();

    console.log(`[DEBUG] Updated offer status to accepted`);

    // Update request status jadi closed
    await Request.findByIdAndUpdate(requestId, { status: 'closed' });

    console.log(`[DEBUG] Updated request status to closed`);

    // Hitung total amount
    const total = selectedOffer.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    console.log(`[DEBUG] Calculated total amount: ${total}`);

    // Validate items structure
    if (!selectedOffer.items || !Array.isArray(selectedOffer.items) || selectedOffer.items.length === 0) {
      console.error('[DEBUG] Invalid items structure:', selectedOffer.items);
      return res.status(400).json({ message: "Offer items tidak valid" });
    }

    // Check if all items have required fields
    const invalidItems = selectedOffer.items.filter(item => !item.name || !item.price || !item.quantity);
    if (invalidItems.length > 0) {
      console.error('[DEBUG] Items missing required fields:', invalidItems);
      return res.status(400).json({ message: "Beberapa item offer tidak memiliki field yang diperlukan" });
    }

    // Generate token per item per pcs dengan menyimpan harga
    const itemsWithTokens = selectedOffer.items.map(item => {
      const tokens = [];
      for (let i = 0; i < item.quantity; i++) {
        tokens.push(generateUniqueToken());
      }
      return {
        name: item.name,
        quantity: item.quantity,
        price: item.price, // Tambahkan harga per item
        tokens
      };
    });

    console.log(`[DEBUG] Generated tokens for ${itemsWithTokens.length} items:`, itemsWithTokens);

    // Simpan transaksi
    console.log(`[DEBUG] Creating transaction with data:`, {
      request: requestId,
      offer: selectedOffer._id,
      buyer: selectedOffer.request.user,
      vendor: selectedOffer.user,
      items: itemsWithTokens,
      totalAmount: total
    });

    const transaction = await Transaction.create({
      request: requestId,
      offer: selectedOffer._id,
      buyer: selectedOffer.request.user,
      vendor: selectedOffer.user,
      items: itemsWithTokens,
      totalAmount: total
    });

    console.log(`[DEBUG] Successfully created transaction: ${transaction._id}`);

    res.json({ 
      message: "Offer berhasil diterima dan transaksi dibuat", 
      offer: selectedOffer,
      transaction: transaction
    });
  } catch (err) {
    console.error("[DEBUG] Error in acceptOffer:", err);
    console.error("[DEBUG] Error stack:", err.stack);
    res.status(500).json({ message: err.message });
  }
};

exports.rejectOffer = async (req, res) => {
  const { offerId } = req.params;

  try {
    // Cari offer yang ingin ditolak
    const selectedOffer = await Offer.findById(offerId).populate('request');
    if (!selectedOffer) {
      return res.status(404).json({ message: "Offer tidak ditemukan" });
    }

    // Cek apakah request milik user yang login
    if (selectedOffer.request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Tidak diizinkan menolak offer untuk request ini" });
    }

    // Update offer jadi rejected
    selectedOffer.status = 'rejected';
    await selectedOffer.save();

    res.json({ message: "Offer berhasil ditolak", offer: selectedOffer });
  } catch (err) {
    console.error("Error menolak offer:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('request')
      .populate('user', 'name email');
    if (!offer) {
      return res.status(404).json({ message: "Offer tidak ditemukan" });
    }
    res.json(offer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOffersByRequestId = async (req, res) => {
  try {
    const offers = await Offer.find({ request: req.params.id })
      .populate('user', 'name email');

    res.json(offers);
  } catch (err) {
    res.status(500).json({ message: err.message });
    console.log(err.message);
  }
};
