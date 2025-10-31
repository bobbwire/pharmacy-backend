// ==============================
// PHARMACY MANAGEMENT BACKEND
// ==============================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ------------------------------
// ✅ Enhanced CORS Configuration
// ------------------------------
const allowedOrigins = [
  'https://pharmacy-pi-jade.vercel.app', // Frontend (Vercel)
  'http://localhost:3000',               // Create React App
  'http://localhost:5175',               // Vite frontend (your current)
  'http://localhost:5173',               // Vite default
  'http://127.0.0.1:5175',               // Localhost alternative
  'http://127.0.0.1:5173'                // Localhost alternative
];

// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ Allowed CORS for: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`❌ Blocked by CORS: ${origin}`);
      console.log(`ℹ️ Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('CORS policy: Origin not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Explicitly handle OPTIONS requests for all routes
app.options('*', cors());

// ------------------------------
// ✅ Middleware
// ------------------------------
app.use(express.json({ limit: '10mb' })); // handle large payloads

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

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
    allowedOrigins: allowedOrigins
  });
});

// Additional health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Pharmacy Backend API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cors: {
      enabled: true,
      allowedOrigins: allowedOrigins.length
    }
  });
});

// Test CORS endpoint
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS test successful!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    cors: 'Working correctly'
  });
});

// ------------------------------
// ✅ 404 Handler
// ------------------------------
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// ------------------------------
// ✅ Global Error Handler
// ------------------------------
app.use((err, req, res, next) => {
  console.error('⚠️ Error:', err.message);
  
  // CORS error
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      message: err.message,
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin
    });
  }
  
  // MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoNetworkError') {
    return res.status(503).json({
      message: 'Database connection error. Please try again later.'
    });
  }
  
  // Default error
  res.status(500).json({
    message: err.message || 'Internal server error. Please try again later.',
  });
});

// ------------------------------
// ✅ Graceful Shutdown
// ------------------------------
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// ------------------------------
// ✅ Start Server (Render)
// ------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed CORS origins:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log(`📊 Health check: https://pharmacy-backend-qrb8.onrender.com/api/health`);
  console.log(`🔧 CORS test: https://pharmacy-backend-qrb8.onrender.com/api/cors-test`);
});
