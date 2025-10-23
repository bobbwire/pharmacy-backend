const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    required: true,
    enum: ['sales', 'stock', 'analytics']
  },
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'custom']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
reportSchema.index({ reportType: 1, period: 1, createdAt: -1 });
reportSchema.index({ generatedBy: 1 });
reportSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Report', reportSchema);