const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: String,
    spec: String,
    budget: { type: Number, required: true },
    quantity: { type: Number, required: true }
});

const requestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [itemSchema],
    deadline: { type: Date, required: true },
    status: { type: String, default: "open" }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);
