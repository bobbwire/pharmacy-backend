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
  'https://pharmacy-pi-jade.vercel.app', // Frontend (Vercel)
  'http://localhost:3000'                // Local development
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman / curl / mobile
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ Blocked by CORS: ${origin}`);
      callback(new Error('CORS policy: Origin not allowed'), false);
    }
  },
  credentials: true,
}));

// ------------------------------
// ✅ Middleware
// ------------------------------
app.use(express.json({ limit: '10mb' })); // handle large payloads

// ------------------------------
// ✅ Database Connection
// ------------------------------
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// ------------------------------
// ✅ Routes
// ------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/drugs', require('./routes/drugs'));
app.use('/api/sales', require('./routes/sale')); // plural path
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));

// ------------------------------
// ✅ Health Check Route
// ------------------------------
app.get('/', (req, res) => {
  res.status(200).json({
    message: '✅ Pharmacy Management System API running successfully',
    backend: 'https://pharmacy-backend-qrb8.onrender.com',
    frontend: 'https://pharmacy-pi-jade.vercel.app',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------
// ✅ Global Error Handler
// ------------------------------
app.use((err, req, res, next) => {
  console.error('⚠️ Error:', err.message || err.stack);
  res.status(500).json({
    message: err.message || 'Internal server error. Please try again later.',
  });
});

// ------------------------------
// ✅ Start Server (Render)
// ------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
