const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  drug: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drug',
    required: true
  },
  drugName: { 
    type: String, 
    required: true,
    trim: true
  },
  batchNo: { 
    type: String, 
    required: true,
    trim: true
  },
  category: { 
    type: String,
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  unitPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  totalPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },
  profit: {
    type: Number,
    default: 0
  }
}, {
  _id: true
});

const saleSchema = new mongoose.Schema({
  saleNumber: { 
    type: String, 
    unique: true,
    index: true
  },
  items: [saleItemSchema],
  totalAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  totalItems: { 
    type: Number, 
    required: true,
    min: 1
  },
  totalCost: {
    type: Number,
    min: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  profitMargin: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile_money'],
    default: 'cash'
  },
  customerName: { 
    type: String, 
    default: '',
    trim: true
  },
  customerPhone: { 
    type: String, 
    default: '',
    trim: true
  },
  soldBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: ['completed', 'cancelled', 'refunded'], 
    default: 'completed'
  },
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  month: {
    type: String,
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: {
    type: Number
  },
  hour: {
    type: Number,
    min: 0,
    max: 23
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance in reports
saleSchema.index({ createdAt: -1 });
saleSchema.index({ paymentMethod: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ 'items.drug': 1 });
saleSchema.index({ 'items.category': 1 });
saleSchema.index({ totalAmount: 1 });
saleSchema.index({ dayOfWeek: 1 });
saleSchema.index({ month: 1, year: 1 });

// Auto-generate saleNumber, totals, and analytics fields
saleSchema.pre('save', async function (next) {
  try {
    // Generate sale number if not exists
    if (!this.saleNumber) {
      const count = await this.constructor.countDocuments();
      this.saleNumber = `SL${String(count + 1).padStart(4, '0')}`;
    }

    // Calculate totals from items
    this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Calculate cost and profit if costPrice is available
    let totalCost = 0;
    this.items.forEach(item => {
      if (item.costPrice) {
        const itemCost = item.costPrice * item.quantity;
        totalCost += itemCost;
        item.profit = item.totalPrice - itemCost;
      }
    });
    
    if (totalCost > 0) {
      this.totalCost = totalCost;
      this.totalProfit = this.totalAmount - totalCost;
      this.profitMargin = (this.totalProfit / this.totalAmount) * 100;
    }

    // Set analytics fields for better reporting
    if (this.createdAt) {
      const date = new Date(this.createdAt);
      this.dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      this.month = date.toLocaleDateString('en-US', { month: 'long' });
      this.year = date.getFullYear();
      this.hour = date.getHours();
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Static method to get sales summary for a period
saleSchema.statics.getSalesSummary = async function(startDate, endDate) {
  return this.aggregate([
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
        totalProfit: { $sum: '$totalProfit' },
        averageSale: { $avg: '$totalAmount' },
        maxSale: { $max: '$totalAmount' },
        minSale: { $min: '$totalAmount' }
      }
    }
  ]);
};

// Static method to get top selling drugs for a period
saleSchema.statics.getTopSellingDrugs = async function(startDate, endDate, limit = 10) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
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
        totalCost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
        averagePrice: { $avg: '$items.unitPrice' },
        saleCount: { $sum: 1 }
      }
    },
    {
      $project: {
        drugId: '$_id.drugId',
        drugName: '$_id.drugName',
        category: '$_id.category',
        totalQuantity: 1,
        totalRevenue: 1,
        totalCost: 1,
        totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
        averagePrice: 1,
        saleCount: 1
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get sales by time period (hourly, daily, monthly)
saleSchema.statics.getSalesByTimePeriod = async function(startDate, endDate, period = 'daily') {
  let groupBy = {};
  
  switch (period) {
    case 'hourly':
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: '$hour'
      };
      break;
    case 'daily':
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'monthly':
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    default:
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: groupBy,
        date: { $first: '$createdAt' },
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalItems: { $sum: '$totalItems' },
        totalProfit: { $sum: '$totalProfit' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
  ]);
};

// Static method to get sales by payment method
saleSchema.statics.getSalesByPaymentMethod = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageSale: { $avg: '$totalAmount' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

// Static method to get customer analytics
saleSchema.statics.getCustomerAnalytics = async function(startDate, endDate, limit = 10) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        customerName: { $ne: '' },
        customerPhone: { $ne: '' }
      }
    },
    {
      $group: {
        _id: '$customerPhone',
        customerName: { $first: '$customerName' },
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' },
        averagePurchase: { $avg: '$totalAmount' },
        firstPurchase: { $min: '$createdAt' },
        lastPurchase: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        customerName: 1,
        phone: '$_id',
        totalPurchases: 1,
        totalSpent: 1,
        averagePurchase: 1,
        firstPurchase: 1,
        lastPurchase: 1,
        customerSince: { $dateToString: { format: '%Y-%m-%d', date: '$firstPurchase' } }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limit }
  ]);
};

// Instance method to calculate sale duration (if needed for analytics)
saleSchema.methods.getSaleDuration = function() {
  // This would calculate time taken for sale if you track start time
  return null; // Implement based on your business logic
};

// Virtual for formatted date
saleSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Virtual for formatted time
saleSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString();
});

// Ensure virtual fields are serialized
saleSchema.set('toJSON', { virtuals: true });
saleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sale', saleSchema);