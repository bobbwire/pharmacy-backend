const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Drug name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  batchNo: {
    type: String,
    required: [true, 'Batch number is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  supplier: {
    type: String,
    required: [true, 'Supplier is required'],
    trim: true
  },
  minStockLevel: {
    type: Number,
    default: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for batch number and pharmacy to ensure uniqueness per pharmacy
drugSchema.index({ batchNo: 1, pharmacy: 1 }, { unique: true });

// Index for better query performance
drugSchema.index({ expiryDate: 1 });
drugSchema.index({ quantity: 1 });
drugSchema.index({ category: 1 });
drugSchema.index({ pharmacy: 1 });

// Virtual for checking if drug is low stock
drugSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.minStockLevel;
});

// Virtual for checking if drug is expired
drugSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiryDate;
});

// Virtual for checking if drug is near expiry (30 days)
drugSchema.virtual('isNearExpiry').get(function() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.expiryDate <= thirtyDaysFromNow && this.expiryDate > new Date();
});

// Method to update stock
drugSchema.methods.updateStock = function(quantitySold) {
  if (this.quantity < quantitySold) {
    throw new Error('Insufficient stock');
  }
  this.quantity -= quantitySold;
  return this.save();
};

// Static method to get low stock drugs
drugSchema.statics.getLowStock = function(pharmacyId) {
  return this.find({
    pharmacy: pharmacyId,
    quantity: { $lte: 10 },
    isActive: true
  });
};

// Static method to get expired drugs
drugSchema.statics.getExpired = function(pharmacyId) {
  return this.find({
    pharmacy: pharmacyId,
    expiryDate: { $lt: new Date() },
    isActive: true
  });
};

// Static method to get near expiry drugs
drugSchema.statics.getNearExpiry = function(pharmacyId) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  return this.find({
    pharmacy: pharmacyId,
    expiryDate: {
      $gte: new Date(),
      $lte: thirtyDaysFromNow
    },
    isActive: true
  });
};

module.exports = mongoose.model('Drug', drugSchema);