const mongoose = require('mongoose');

const offerItemSchema = new mongoose.Schema({
  name: { type: String, required: true }, // mengikuti nama item dari request
  brand: String,
  spec: String,
  price: { type: Number, required: true }, // harga penawaran per pcs
  quantity: { type: Number, required: true }, // harus sesuai dengan quantity dari request item
  notes: String
});

const offerSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // user yang memberikan offer
  items: [offerItemSchema],
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
