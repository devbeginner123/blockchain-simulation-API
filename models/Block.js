const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
    unique: true
  },
  timestamp: {
    type: String,
    required: true
  },
  data: {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true
    },
    buyer: {
      type: String,
      required: true
    },
    vendor: {
      type: String,
      required: true
    },
    buyerName: {
      type: String
    },
    vendorName: {
      type: String
    },
    items: [{
      name: {
        type: String,
        required: true
      },
      token: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    total: {
      type: Number,
      required: true
    },
    timestamp: {
      type: String,
      required: true
    }
  },
  previousHash: {
    type: String,
    required: true,
    default: '0'.repeat(64)
  },
  nonce: {
    type: Number,
    required: true,
    default: 0
  },
  hash: {
    type: String,
    required: true
  }
}, {
  timestamps: true // Menambahkan createdAt dan updatedAt otomatis
});

// Index untuk optimasi query
blockSchema.index({ index: 1 });
blockSchema.index({ hash: 1 });
blockSchema.index({ 'data.transactionId': 1 });

module.exports = mongoose.model('Block', blockSchema);