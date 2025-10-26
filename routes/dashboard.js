const express = require('express');
const {
  getDashboardStats,
  getInventoryOverview,
  getSalesAnalytics
} = require('../Controllers/dashboardController');
const { protect } = require('../Middleware/Auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes
router.get('/', getDashboardStats);
router.get('/inventory', getInventoryOverview);
router.get('/analytics', getSalesAnalytics);

module.exports = router;
