const mongoose = require('mongoose');
const crypto = require('crypto');

const itemTokenSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  price: Number, // Tambahkan field harga per item
  tokens: [String] // 1 token per pcs
});

const transactionSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [itemTokenSchema],
  totalAmount: Number,
  status: {
    type: String,
    enum: ['waiting_payment', 'in_progress', 'shipped', 'validating', 'completed', 'cancelled'],
    default: 'waiting_payment'
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);