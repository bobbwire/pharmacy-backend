const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/drugs', require('./routes/drugs'));
//app.use('/api/sale', require('./routes/sale')); // Fixed from '/api/sale' to '/api/sales'
app.use('/api/sales', require('./routes/sale')); // NOT '/api/sale'
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports')); // 

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Pharmacy Management System API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});