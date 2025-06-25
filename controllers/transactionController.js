const Offer = require('../models/Offer');
const Request = require('../models/Request');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

const generateUniqueToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

exports.acceptOffer = async (req, res) => {
  const { offerId } = req.params;

  try {
    const offer = await Offer.findById(offerId).populate('request user');
    if (!offer) return res.status(404).json({ message: 'Offer tidak ditemukan' });

    if (!offer.request || !offer.request._id) {
      return res.status(400).json({ message: 'Field "request" pada offer tidak valid atau hilang' });
    }

    const request = await Request.findById(offer.request._id);
    if (String(request.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk request ini' });
    }

    // Tolak semua offer lain
    await Offer.updateMany(
      { request: request._id, _id: { $ne: offerId } },
      { $set: { status: 'rejected' } }
    );

    // Tandai offer terpilih
    request.status = 'closed';
    offer.status = 'accepted';
    await offer.save();

    // Hitung total amount
    const total = offer.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Generate token per item per pcs dengan menyimpan harga
    const itemsWithTokens = offer.items.map(item => {
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

    // Simpan transaksi
    const transaction = await Transaction.create({
      request: request._id,
      offer: offer._id,
      buyer: request.user,
      vendor: offer.user,
      items: itemsWithTokens,
      totalAmount: total
    });

    res.status(201).json({
      message: 'Offer diterima, transaksi dibuat.',
      transaction
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateDeliveryStatus = async (req, res) => {
  const { transactionId } = req.params;
  const { status } = req.body;

  const allowedStatuses = ['in_progress', 'shipped', 'validating', 'completed', 'cancelled'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    if (String(transaction.vendor) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Anda bukan vendor dari transaksi ini' });
    }

    transaction.status = status;
    await transaction.save();

    res.json({ message: 'Status pengiriman berhasil diperbarui', transaction });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.validateTokens = async (req, res) => {
  const { transactionId } = req.params;
  const { tokens } = req.body; 

  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    if (String(transaction.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Anda bukan pembeli dari transaksi ini' });
    }

    let allTokens = [];
    transaction.items.forEach(item => {
      allTokens = allTokens.concat(item.tokens);
    });

    // Cek duplikat token
    const validTokens = tokens.filter(token => allTokens.includes(token));
    const uniqueTokens = [...new Set(validTokens)];

    // Cek jika semua token tervalidasi
    if (uniqueTokens.length !== allTokens.length) {
      return res.status(400).json({
        message: `Token tidak valid atau belum lengkap. Total valid: ${uniqueTokens.length}/${allTokens.length}`
      });
    }

    transaction.status = 'completed';
    await transaction.save();

    res.json({ message: 'Semua token berhasil divalidasi. Transaksi selesai.', transaction });

  } catch (err) {
    console.error('Error during token validation:', err); 
    res.status(500).json({ message: err.message });
  }
};

exports.getUserTransactions = async (req, res) => {
  try {
    console.log(`[DEBUG] Getting transactions for user: ${req.user._id}`);
    
    // Mencari transaksi berdasarkan status dan ID user yang login (buyer atau vendor)
    const transactions = await Transaction.find({
      $or: [
        { buyer: req.user._id }, // mencari transaksi sebagai pembeli
        { vendor: req.user._id }  // mencari transaksi sebagai vendor
      ],
    })
      .populate('request')
      .populate('offer')
      .populate('buyer', 'name')
      .populate('vendor', 'name')
      .select('status totalAmount items createdAt vendor buyer request offer');
    console.log(`[DEBUG] Found ${transactions.length} transactions for user`);

    // Return empty array instead of 404 when no transactions found
    res.status(200).json({
      message: transactions.length > 0 ? 'Transaksi berhasil ditemukan' : 'Tidak ada transaksi yang ditemukan',
      transactions: transactions || []
    });

  } catch (err) {
    console.error('[DEBUG] Error in getUserTransactions:', err);
    res.status(500).json({ message: err.message });
    console.log(err);
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('request offer')
      .populate('buyer', 'name')
      .populate('vendor', 'name');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }

    // Pastikan hanya buyer/vendor terkait yang bisa mengakses
    if (
      String(transaction.buyer._id) !== String(req.user._id) &&
      String(transaction.vendor._id) !== String(req.user._id)
    ) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke transaksi ini' });
    }

    // Transaction items sudah lengkap dengan harga, tidak perlu populate tambahan
    res.json({ transaction });

  } catch (err) {
    console.error('Error in getTransactionById:', err);
    res.status(500).json({ message: err.message });
  }
};