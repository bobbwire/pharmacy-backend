// ==============================
// PHARMACY MANAGEMENT BACKEND
// ==============================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ------------------------------
// ✅ CORS Configuration
// ------------------------------
const allowedOrigins = [
  'https://pharmacy-pi-jade.vercel.app', // ✅ Frontend (Vercel)
  'http://localhost:3000'                // ✅ Local development
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman or mobile
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error('CORS policy: Origin not allowed'), false);
    }
  },
  credentials: true,
}));

app.use(express.json());

// ------------------------------
// ✅ Database Connection
// ------------------------------
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err.message));

// ------------------------------
// ✅ Routes
// ------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/drugs', require('./routes/drugs'));
app.use('/api/sales', require('./routes/sale')); // corrected plural path
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));

// ------------------------------
// ✅ Basic Health Check Route
// ------------------------------
app.get('/', (req, res) => {
  res.status(200).json({
    message: '✅ Pharmacy Management System API running successfully',
    backend: 'https://pharmacy-backend-qrb8.onrender.com',
    frontend: 'https://pharmacy-pi-jade.vercel.app',
    status: 'online'
  });
});

// ------------------------------
// ✅ Global Error Handler
// ------------------------------
app.use((err, req, res, next) => {
  console.error('Error:', err.stack || err.message);
  res.status(500).json({
    message: '⚠️ Internal server error. Please try again later.'
  });
});

// ------------------------------
// ✅ Server Listen (Render)
// ------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
