const Drug = require('../models/Drug');
const Sale = require('../models/Sale');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total drugs count
    const totalDrugs = await Drug.countDocuments();

    // Get today's sales total
    const todaySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get low stock drugs count
    const lowStockDrugs = await Drug.countDocuments({
      quantity: { $lte: 10 }
    });

    // Get expired drugs count
    const expiredDrugs = await Drug.countDocuments({
      expiryDate: { $lt: new Date() }
    });

    // Get recent alerts - low stock
    const lowStockAlerts = await Drug.find({
      quantity: { $lte: 10, $gt: 0 }
    })
    .select('name quantity batchNo')
    .limit(5)
    .sort({ quantity: 1 })
    .lean();

    // Get recent alerts - near expiry (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const nearExpiryAlerts = await Drug.find({
      expiryDate: { 
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    })
    .select('name expiryDate batchNo')
    .limit(5)
    .sort({ expiryDate: 1 })
    .lean();

    // Get recent sales
    const recentSales = await Sale.find()
      .populate('soldBy', 'username name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Format the response
    const dashboardData = {
      summary: {
        totalDrugs,
        totalSales: todaySales[0]?.total || 0,
        lowStock: lowStockDrugs,
        expiredDrugs,
        todaySalesCount: todaySales[0]?.count || 0
      },
      alerts: {
        lowStock: lowStockAlerts.map(drug => ({
          _id: drug._id,
          type: 'low-stock',
          message: `${drug.name} stock is low (${drug.quantity} units remaining)`,
          drug: drug.name,
          batchNo: drug.batchNo
        })),
        nearExpiry: nearExpiryAlerts.map(drug => ({
          _id: drug._id,
          type: 'expiry',
          message: `${drug.name} expires on ${new Date(drug.expiryDate).toLocaleDateString()}`,
          drug: drug.name,
          batchNo: drug.batchNo
        }))
      },
      recentSales: recentSales.map(sale => ({
        _id: sale._id,
        saleNumber: sale.saleNumber,
        totalAmount: sale.totalAmount,
        createdAt: sale.createdAt,
        soldBy: sale.soldBy ? {
          username: sale.soldBy.username,
          name: sale.soldBy.name
        } : { username: 'System', name: 'System' }
      }))
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching dashboard data',
      error: error.message 
    });
  }
};

// @desc    Get inventory overview
// @route   GET /api/dashboard/inventory
// @access  Private
const getInventoryOverview = async (req, res) => {
  try {
    const inventoryStats = await Drug.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          outOfStock: {
            $sum: { $cond: [{ $lte: ['$quantity', 0] }, 1, 0] }
          },
          lowStock: {
            $sum: { $cond: [{ $lte: ['$quantity', 10] }, 1, 0] }
          }
        }
      }
    ]);

    const categoryDistribution = await Drug.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const lowStockItems = await Drug.find({
      quantity: { $lte: 10, $gt: 0 }
    })
    .select('name quantity price category')
    .sort({ quantity: 1 })
    .limit(10)
    .lean();

    const overview = inventoryStats[0] || {
      totalValue: 0,
      totalItems: 0,
      totalQuantity: 0,
      outOfStock: 0,
      lowStock: 0
    };

    res.json({
      overview,
      categories: categoryDistribution,
      lowStockItems
    });
  } catch (error) {
    console.error('Get inventory overview error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching inventory overview',
      error: error.message 
    });
  }
};

// @desc    Get sales analytics
// @route   GET /api/dashboard/analytics
// @access  Private
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Sales trend data
    const salesTrend = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top selling drugs
    const topSellingDrugs = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.drugName',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Sales by payment method
    const salesByPayment = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.json({
      period,
      salesTrend,
      topSellingDrugs,
      salesByPayment
    });
  } catch (error) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching sales analytics',
      error: error.message 
    });
  }
};

module.exports = {
  getDashboardStats,
  getInventoryOverview,
  getSalesAnalytics
};