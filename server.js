const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
dotenv.config();

const app = express();

// ✅ Middleware dulu
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// ✅ Import routes setelah middleware
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const requestRoutes = require('./routes/requests');
app.use('/api/requests', requestRoutes);

const offerRoutes = require('./routes/offers');
app.use('/api/offers', offerRoutes);

const transactionRoutes = require('./routes/transactions');
app.use('/api/transactions', transactionRoutes);

const blockchainRoutes = require('./routes/blockchain');
app.use('/api/blockchain', blockchainRoutes);

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB Connected");
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}).catch(err => console.error(err));
