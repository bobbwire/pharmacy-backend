const Sale = require('../models/Sale');
const Drug = require('../models/Drug');
const Report = require('../models/Report');

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private
const getSalesReport = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let startDate, endDate;
    const now = new Date();

    // Set date ranges based on period - FIXED DATE CALCULATION
    switch (period) {
      case 'daily':
        // Today's date
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        // Last 7 days including today
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // Last 7 days including today
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        // Last 30 days including today
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29); // Last 30 days including today
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        // Default to today
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    console.log(`Fetching sales data from ${startDate} to ${endDate}`);
    console.log(`Period: ${period}, Current date: ${now}`);

    // Get sales data for the period
    const salesData = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalItems: { $sum: '$totalItems' },
          averageSale: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Get top selling drugs for the period
    const topSellingDrugs = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.drugName',
          drugId: { $first: '$items.drug' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          averagePrice: { $avg: '$items.unitPrice' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Get sales by payment method
    const salesByPayment = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get daily sales trend for the period
    const dailyTrend = await getDailySalesTrend(startDate, endDate);

    const reportData = {
      period,
      startDate,
      endDate,
      summary: salesData[0] || {
        totalSales: 0,
        totalRevenue: 0,
        totalItems: 0,
        averageSale: 0
      },
      topSelling: topSellingDrugs.map(drug => ({
        name: drug._id,
        drugId: drug.drugId,
        quantity: drug.totalQuantity,
        revenue: drug.totalRevenue,
        averagePrice: Math.round(drug.averagePrice || 0)
      })),
      paymentMethods: salesByPayment,
      dailyTrend
    };

    console.log('Sales report generated:', reportData.summary);

    res.json({
      success: true,
      report: reportData
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating sales report',
      error: error.message
    });
  }
};

// @desc    Get stock report
// @route   GET /api/reports/stock
// @access  Private
const getStockReport = async (req, res) => {
  try {
    // Get real stock data from Drug collection
    const stockData = await Drug.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalDrugs: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
          totalQuantity: { $sum: '$quantity' },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', 10] }] },
                1,
                0
              ]
            }
          },
          outOfStock: {
            $sum: { $cond: [{ $lte: ['$quantity', 0] }, 1, 0] }
          },
          expired: {
            $sum: { $cond: [{ $lt: ['$expiryDate', new Date()] }, 1, 0] }
          }
        }
      }
    ]);

    // Get drugs by category - FROM ACTUAL DRUGS DATA
    const drugsByCategory = await Drug.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get low stock items - REAL DATA
    const lowStockItems = await Drug.find({
      quantity: { $lte: 10, $gt: 0 },
      isActive: true
    })
    .select('name quantity price minStockLevel category batchNo')
    .sort({ quantity: 1 })
    .limit(20)
    .lean();

    // Get expired drugs - REAL DATA
    const expiredDrugs = await Drug.find({
      expiryDate: { $lt: new Date() },
      isActive: true
    })
    .select('name expiryDate quantity batchNo')
    .sort({ expiryDate: 1 })
    .limit(20)
    .lean();

    const reportData = {
      summary: stockData[0] || {
        totalDrugs: 0,
        totalValue: 0,
        totalQuantity: 0,
        lowStock: 0,
        outOfStock: 0,
        expired: 0
      },
      categories: drugsByCategory,
      lowStock: lowStockItems,
      expired: expiredDrugs
    };

    console.log('Stock report generated:', reportData.summary);

    res.json({
      success: true,
      report: reportData
    });
  } catch (error) {
    console.error('Get stock report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating stock report',
      error: error.message
    });
  }
};

// @desc    Get analytics data
// @route   GET /api/reports/analytics
// @access  Private
const getAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    let startDate;
    const endDate = new Date();

    // FIXED DATE CALCULATIONS
    switch (period) {
      case 'daily':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log(`Analytics period: ${period}, from ${startDate} to ${endDate}`);

    // Sales analytics
    const salesAnalytics = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          date: { $first: '$createdAt' },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalItems: { $sum: '$totalItems' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top performing drugs
    const topDrugs = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.drugName',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          category: { $first: '$items.category' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 15 }
    ]);

    // Customer analytics
    const customerAnalytics = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
          customerName: { $ne: '' }
        }
      },
      {
        $group: {
          _id: '$customerPhone',
          customerName: { $first: '$customerName' },
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastPurchase: { $max: '$createdAt' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    // Payment method distribution
    const paymentDistribution = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const analyticsData = {
      period,
      startDate,
      endDate,
      salesTrend: salesAnalytics,
      topDrugs,
      topCustomers: customerAnalytics,
      paymentDistribution,
      summary: {
        totalPeriodSales: salesAnalytics.reduce((sum, day) => sum + day.totalSales, 0),
        totalPeriodRevenue: salesAnalytics.reduce((sum, day) => sum + day.totalRevenue, 0),
        averageDailySales: salesAnalytics.length > 0 ? 
          salesAnalytics.reduce((sum, day) => sum + day.totalRevenue, 0) / salesAnalytics.length : 0,
        uniqueCustomers: customerAnalytics.length
      }
    };

    console.log('Analytics generated:', analyticsData.summary);

    res.json({
      success: true,
      analytics: analyticsData
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics',
      error: error.message
    });
  }
};

// @desc    Export report
// @route   POST /api/reports/export
// @access  Private
const exportReport = async (req, res) => {
  try {
    const { reportType, format, period, startDate, endDate } = req.body;

    let reportData;
    
    // Generate actual report data based on type
    switch (reportType) {
      case 'sales':
        reportData = await generateSalesReportData(period, startDate, endDate);
        break;
      case 'stock':
        reportData = await generateStockReportData();
        break;
      case 'analytics':
        reportData = await generateAnalyticsReportData(period, startDate, endDate);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    const exportResult = {
      reportType,
      format,
      period,
      startDate,
      endDate,
      data: reportData,
      generatedAt: new Date(),
      generatedBy: req.user.username,
      downloadUrl: `/api/reports/download/${Date.now()}-${reportType}.${format}`
    };

    console.log(`Report exported: ${reportType} as ${format}`);

    res.json({
      success: true,
      message: `Report exported successfully as ${format.toUpperCase()}`,
      export: exportResult
    });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting report',
      error: error.message
    });
  }
};

// Helper function to get daily sales trend from ACTUAL SALES
const getDailySalesTrend = async (startDate, endDate) => {
  const days = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const daySales = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: dayStart, $lte: dayEnd },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    days.push({
      date: new Date(currentDate),
      totalSales: daySales[0]?.totalSales || 0,
      totalRevenue: daySales[0]?.totalRevenue || 0
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
};

// Helper functions that return ACTUAL DATA for export
const generateSalesReportData = async (period, startDate, endDate) => {
  // Get actual sales data for export
  const salesData = await Sale.find({
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
    status: 'completed'
  })
  .populate('soldBy', 'username name')
  .sort({ createdAt: -1 });

  return {
    period,
    startDate,
    endDate,
    totalSales: salesData.length,
    totalRevenue: salesData.reduce((sum, sale) => sum + sale.totalAmount, 0),
    sales: salesData
  };
};

const generateStockReportData = async () => {
  // Get actual stock data for export
  const drugs = await Drug.find({ isActive: true })
    .select('name category batchNo quantity price costPrice expiryDate supplier')
    .sort({ category: 1, name: 1 });

  return {
    totalDrugs: drugs.length,
    totalValue: drugs.reduce((sum, drug) => sum + (drug.quantity * drug.price), 0),
    drugs: drugs
  };
};

const generateAnalyticsReportData = async (period, startDate, endDate) => {
  // Get actual analytics data for export
  const sales = await Sale.find({
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
    status: 'completed'
  });

  const topDrugs = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: 'completed'
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.drugName',
        totalSold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.totalPrice' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 20 }
  ]);

  return {
    period,
    startDate,
    endDate,
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    topDrugs: topDrugs
  };
};

// Make sure ALL functions are exported
module.exports = {
  getSalesReport,
  getStockReport, // This was missing!
  getAnalytics,
  exportReport
};