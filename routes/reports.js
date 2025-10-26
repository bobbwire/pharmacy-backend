const express = require('express');
const {
  getSalesReport,
  getStockReport,
  getAnalytics,
  exportReport
} = require('../Controllers/reportController');
const { protect } = require('../Middleware/Auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Reports routes
router.get('/sales', getSalesReport);
router.get('/stock', getStockReport);
router.get('/analytics', getAnalytics);
router.post('/export', exportReport);

module.exports = router;
