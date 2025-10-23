const Sale = require('../models/Sale');
const Drug = require('../models/Drug');

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res) => {
  try {
    const { items, paymentMethod, customerName, customerPhone } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Sale must have at least one item' 
      });
    }

    const pharmacyId = req.user.pharmacy || req.user._id;
    const saleItems = [];
    let totalAmount = 0;
    let totalItems = 0;

    // Validate stock and prepare sale items
    for (const item of items) {
      const drug = await Drug.findOne({
        _id: item.drugId,
        pharmacy: pharmacyId,
        isActive: true
      });

      if (!drug) {
        return res.status(404).json({
          success: false,
          message: `Drug not found: ${item.drugId}`
        });
      }

      if (drug.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${drug.name}. Available: ${drug.quantity}, Requested: ${item.quantity}`
        });
      }

      const itemTotal = drug.price * item.quantity;
      totalAmount += itemTotal;
      totalItems += item.quantity;

      saleItems.push({
        drug: drug._id,
        drugName: drug.name,
        batchNo: drug.batchNo,
        category: drug.category,
        quantity: item.quantity,
        unitPrice: drug.price,
        totalPrice: itemTotal
      });
    }

    // Create sale
    const sale = new Sale({
      items: saleItems,
      totalAmount,
      totalItems,
      paymentMethod: paymentMethod || 'cash',
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      soldBy: req.user._id,
      pharmacy: pharmacyId
    });

    // Update drug quantities in a transaction-like manner
    const updatePromises = items.map(item =>
      Drug.findByIdAndUpdate(
        item.drugId,
        { $inc: { quantity: -item.quantity } },
        { new: true }
      )
    );

    await Promise.all(updatePromises);
    const createdSale = await sale.save();
    
    // Populate the sale for response
    const populatedSale = await Sale.findById(createdSale._id)
      .populate('soldBy', 'username firstName lastName')
      .populate('items.drug', 'name category batchNo price')
      .lean();

    // Format the response for frontend
    const formattedSale = {
      ...populatedSale,
      formattedDate: new Date(populatedSale.createdAt).toLocaleDateString(),
      formattedTime: new Date(populatedSale.createdAt).toLocaleTimeString(),
      soldBy: populatedSale.soldBy ? {
        _id: populatedSale.soldBy._id,
        username: populatedSale.soldBy.username,
        name: populatedSale.soldBy.firstName ? 
          `${populatedSale.soldBy.firstName} ${populatedSale.soldBy.lastName}` : 
          populatedSale.soldBy.username
      } : { username: 'System', name: 'System' }
    };

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      sale: formattedSale
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing sale',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all sales with pagination and filters
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate,
      search,
      paymentMethod 
    } = req.query;
    
    const pharmacyId = req.user.pharmacy || req.user._id;
    const query = { pharmacy: pharmacyId, status: 'completed' };
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    // Search filter (by sale number or customer name)
    if (search) {
      query.$or = [
        { saleNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }

    const sales = await Sale.find(query)
      .populate('soldBy', 'username firstName lastName')
      .populate('items.drug', 'name category batchNo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Sale.countDocuments(query);
    
    // Calculate total revenue for the filtered results
    const revenueResult = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Format sales for frontend
    const formattedSales = sales.map(sale => ({
      ...sale,
      formattedDate: new Date(sale.createdAt).toLocaleDateString(),
      formattedTime: new Date(sale.createdAt).toLocaleTimeString(),
      soldBy: sale.soldBy ? {
        _id: sale.soldBy._id,
        username: sale.soldBy.username,
        name: sale.soldBy.firstName ? 
          `${sale.soldBy.firstName} ${sale.soldBy.lastName}` : 
          sale.soldBy.username
      } : { username: 'System', name: 'System' }
    }));

    res.json({
      success: true,
      sales: formattedSales,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      summary: {
        totalRevenue: revenueResult[0]?.total || 0,
        totalSales: total
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
const getSale = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    const sale = await Sale.findOne({
      _id: req.params.id,
      pharmacy: pharmacyId
    })
    .populate('soldBy', 'username firstName lastName email')
    .populate('items.drug', 'name category batchNo price costPrice')
    .lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Format sale for frontend
    const formattedSale = {
      ...sale,
      formattedDate: new Date(sale.createdAt).toLocaleDateString(),
      formattedTime: new Date(sale.createdAt).toLocaleTimeString(),
      soldBy: sale.soldBy ? {
        _id: sale.soldBy._id,
        username: sale.soldBy.username,
        name: sale.soldBy.firstName ? 
          `${sale.soldBy.firstName} ${sale.soldBy.lastName}` : 
          sale.soldBy.username,
        email: sale.soldBy.email
      } : { username: 'System', name: 'System', email: '' }
    };

    res.json({
      success: true,
      sale: formattedSale
    });
  } catch (error) {
    console.error('Get sale error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid sale ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sale',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get sales statistics
// @route   GET /api/sales/statistics
// @access  Private
const getSalesStatistics = async (req, res) => {
  try {
    const { period = 'today' } = req.query; // today, week, month, year
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    let startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
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
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }

    const query = {
      pharmacy: pharmacyId,
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate }
    };

    // Basic statistics
    const statistics = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalItems: { $sum: '$totalItems' },
          averageSale: { $avg: '$totalAmount' },
          maxSale: { $max: '$totalAmount' },
          minSale: { $min: '$totalAmount' }
        }
      }
    ]);

    // Payment method breakdown
    const paymentBreakdown = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Top selling drugs
    const topSelling = await Sale.aggregate([
      { $match: query },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            drugId: '$items.drug',
            drugName: '$items.drugName',
            category: '$items.category'
          },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          averagePrice: { $avg: '$items.unitPrice' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Daily sales trend for the period
    const salesTrend = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          date: { $first: '$createdAt' },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const stats = statistics[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageSale: 0,
      maxSale: 0,
      minSale: 0
    };

    res.json({
      success: true,
      period,
      startDate,
      endDate,
      statistics: {
        ...stats,
        averageSale: Math.round(stats.averageSale || 0)
      },
      paymentBreakdown,
      topSelling: topSelling.map(item => ({
        drugId: item._id.drugId,
        drugName: item._id.drugName,
        category: item._id.category,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
        averagePrice: Math.round(item.averagePrice || 0)
      })),
      salesTrend: salesTrend.map(day => ({
        date: day.date,
        totalSales: day.totalSales,
        totalRevenue: day.totalRevenue
      }))
    });
  } catch (error) {
    console.error('Get sales statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sales statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get daily sales report
// @route   GET /api/sales/daily
// @access  Private
const getDailySales = async (req, res) => {
  try {
    const { date } = req.query;
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const query = {
      pharmacy: pharmacyId,
      status: 'completed',
      createdAt: { $gte: targetDate, $lt: nextDate }
    };

    const dailySales = await Sale.find(query)
      .populate('soldBy', 'username firstName lastName')
      .populate('items.drug', 'name category batchNo')
      .sort({ createdAt: -1 })
      .lean();

    const dailyStats = await Sale.aggregate([
      { $match: query },
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

    const stats = dailyStats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageSale: 0
    };

    // Format sales for frontend
    const formattedSales = dailySales.map(sale => ({
      ...sale,
      formattedDate: new Date(sale.createdAt).toLocaleDateString(),
      formattedTime: new Date(sale.createdAt).toLocaleTimeString(),
      soldBy: sale.soldBy ? {
        _id: sale.soldBy._id,
        username: sale.soldBy.username,
        name: sale.soldBy.firstName ? 
          `${sale.soldBy.firstName} ${sale.soldBy.lastName}` : 
          sale.soldBy.username
      } : { username: 'System', name: 'System' }
    }));

    res.json({
      success: true,
      date: targetDate,
      sales: formattedSales,
      statistics: {
        ...stats,
        averageSale: Math.round(stats.averageSale || 0)
      }
    });
  } catch (error) {
    console.error('Get daily sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching daily sales',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get recent sales for dashboard
// @route   GET /api/sales/recent
// @access  Private
const getRecentSales = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const pharmacyId = req.user.pharmacy || req.user._id;

    const recentSales = await Sale.find({ 
      pharmacy: pharmacyId,
      status: 'completed'
    })
    .populate('soldBy', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

    const formattedSales = recentSales.map(sale => ({
      _id: sale._id,
      saleNumber: sale.saleNumber,
      totalAmount: sale.totalAmount,
      totalItems: sale.totalItems,
      paymentMethod: sale.paymentMethod,
      customerName: sale.customerName,
      createdAt: sale.createdAt,
      formattedDate: new Date(sale.createdAt).toLocaleDateString(),
      formattedTime: new Date(sale.createdAt).toLocaleTimeString(),
      soldBy: sale.soldBy ? {
        username: sale.soldBy.username,
        name: sale.soldBy.firstName ? 
          `${sale.soldBy.firstName} ${sale.soldBy.lastName}` : 
          sale.soldBy.username
      } : { username: 'System', name: 'System' }
    }));

    res.json({
      success: true,
      sales: formattedSales
    });
  } catch (error) {
    console.error('Get recent sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent sales',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSale,
  getSalesStatistics,
  getDailySales,
  getRecentSales
};