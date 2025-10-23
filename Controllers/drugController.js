const Drug = require('../models/Drug');

// @desc    Get all drugs
// @route   GET /api/drugs
// @access  Private
const getDrugs = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, lowStock } = req.query;
    
    const pharmacyId = req.user.pharmacy || req.user._id;
    const query = { pharmacy: pharmacyId, isActive: true };
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { batchNo: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category && category !== '') {
      query.category = category;
    }
    
    // Low stock filter
    if (lowStock === 'true') {
      query.$or = [
        { quantity: { $lte: '$minStockLevel' } },
        { quantity: { $lte: 10 } }
      ];
    }

    const drugs = await Drug.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean for better performance

    // Get total count for pagination
    const total = await Drug.countDocuments(query);

    // Get unique categories for filter
    const categories = await Drug.distinct('category', { pharmacy: pharmacyId, isActive: true });

    res.json({
      drugs,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      categories
    });
  } catch (error) {
    console.error('Get drugs error:', error);
    res.status(500).json({ message: 'Server error while fetching drugs' });
  }
};

// @desc    Get single drug
// @route   GET /api/drugs/:id
// @access  Private
const getDrug = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    const drug = await Drug.findOne({
      _id: req.params.id,
      pharmacy: pharmacyId,
      isActive: true
    });

    if (!drug) {
      return res.status(404).json({ message: 'Drug not found' });
    }

    res.json(drug);
  } catch (error) {
    console.error('Get drug error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid drug ID' });
    }
    res.status(500).json({ message: 'Server error while fetching drug' });
  }
};

// @desc    Create new drug
// @route   POST /api/drugs
// @access  Private
const createDrug = async (req, res) => {
  try {
    const {
      name,
      category,
      batchNo,
      quantity,
      price,
      costPrice,
      expiryDate,
      supplier,
      minStockLevel
    } = req.body;

    const pharmacyId = req.user.pharmacy || req.user._id;

    // Check if batch number already exists for this pharmacy
    const existingDrug = await Drug.findOne({ 
      batchNo: batchNo.trim(),
      pharmacy: pharmacyId
    });

    if (existingDrug) {
      return res.status(400).json({ 
        message: 'Drug with this batch number already exists in your pharmacy' 
      });
    }

    // Validate expiry date
    if (new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ 
        message: 'Expiry date must be in the future' 
      });
    }

    const drug = new Drug({
      name: name.trim(),
      category: category.trim(),
      batchNo: batchNo.trim(),
      quantity: parseInt(quantity),
      price: parseFloat(price),
      costPrice: parseFloat(costPrice || price), // Default to price if costPrice not provided
      expiryDate: new Date(expiryDate),
      supplier: supplier.trim(),
      minStockLevel: parseInt(minStockLevel) || 10,
      pharmacy: pharmacyId,
      createdBy: req.user._id
    });

    const createdDrug = await drug.save();
    
    // Convert to object and add virtuals
    const drugObj = createdDrug.toObject();
    drugObj.isLowStock = createdDrug.isLowStock;
    drugObj.isExpired = createdDrug.isExpired;
    drugObj.isNearExpiry = createdDrug.isNearExpiry;

    res.status(201).json(drugObj);
  } catch (error) {
    console.error('Create drug error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Drug with this batch number already exists' });
    } else if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: errors.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while creating drug' });
    }
  }
};

// @desc    Update drug
// @route   PUT /api/drugs/:id
// @access  Private
const updateDrug = async (req, res) => {
  try {
    const {
      name,
      category,
      batchNo,
      quantity,
      price,
      costPrice,
      expiryDate,
      supplier,
      minStockLevel
    } = req.body;

    const pharmacyId = req.user.pharmacy || req.user._id;

    const drug = await Drug.findOne({
      _id: req.params.id,
      pharmacy: pharmacyId,
      isActive: true
    });

    if (!drug) {
      return res.status(404).json({ message: 'Drug not found' });
    }

    // Check if batch number is being changed and if it already exists
    if (batchNo && batchNo.trim() !== drug.batchNo) {
      const existingDrug = await Drug.findOne({ 
        batchNo: batchNo.trim(),
        pharmacy: pharmacyId,
        _id: { $ne: req.params.id }
      });

      if (existingDrug) {
        return res.status(400).json({ 
          message: 'Drug with this batch number already exists in your pharmacy' 
        });
      }
    }

    // Validate expiry date if being updated
    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ 
        message: 'Expiry date must be in the future' 
      });
    }

    // Update fields
    drug.name = name ? name.trim() : drug.name;
    drug.category = category ? category.trim() : drug.category;
    drug.batchNo = batchNo ? batchNo.trim() : drug.batchNo;
    drug.quantity = quantity !== undefined ? parseInt(quantity) : drug.quantity;
    drug.price = price !== undefined ? parseFloat(price) : drug.price;
    drug.costPrice = costPrice !== undefined ? parseFloat(costPrice) : drug.costPrice;
    drug.expiryDate = expiryDate ? new Date(expiryDate) : drug.expiryDate;
    drug.supplier = supplier ? supplier.trim() : drug.supplier;
    drug.minStockLevel = minStockLevel !== undefined ? parseInt(minStockLevel) : drug.minStockLevel;

    const updatedDrug = await drug.save();
    
    // Convert to object and add virtuals
    const drugObj = updatedDrug.toObject();
    drugObj.isLowStock = updatedDrug.isLowStock;
    drugObj.isExpired = updatedDrug.isExpired;
    drugObj.isNearExpiry = updatedDrug.isNearExpiry;

    res.json(drugObj);
  } catch (error) {
    console.error('Update drug error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Drug with this batch number already exists' });
    } else if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: errors.join(', ') });
    } else if (error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid drug ID' });
    } else {
      res.status(500).json({ message: 'Server error while updating drug' });
    }
  }
};

// @desc    Delete drug (soft delete)
// @route   DELETE /api/drugs/:id
// @access  Private
const deleteDrug = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;

    const drug = await Drug.findOne({
      _id: req.params.id,
      pharmacy: pharmacyId,
      isActive: true
    });

    if (!drug) {
      return res.status(404).json({ message: 'Drug not found' });
    }

    // Soft delete by setting isActive to false
    drug.isActive = false;
    await drug.save();

    res.json({ 
      message: 'Drug deleted successfully',
      deletedId: drug._id 
    });
  } catch (error) {
    console.error('Delete drug error:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid drug ID' });
    } else {
      res.status(500).json({ message: 'Server error while deleting drug' });
    }
  }
};

// @desc    Get low stock drugs
// @route   GET /api/drugs/alerts/low-stock
// @access  Private
const getLowStockDrugs = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    const lowStockDrugs = await Drug.getLowStock(pharmacyId)
      .sort({ quantity: 1 })
      .lean();

    res.json(lowStockDrugs);
  } catch (error) {
    console.error('Get low stock drugs error:', error);
    res.status(500).json({ message: 'Server error while fetching low stock drugs' });
  }
};

// @desc    Get expired drugs
// @route   GET /api/drugs/alerts/expired
// @access  Private
const getExpiredDrugs = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    const expiredDrugs = await Drug.getExpired(pharmacyId)
      .sort({ expiryDate: 1 })
      .lean();

    res.json(expiredDrugs);
  } catch (error) {
    console.error('Get expired drugs error:', error);
    res.status(500).json({ message: 'Server error while fetching expired drugs' });
  }
};

// @desc    Get drugs near expiry
// @route   GET /api/drugs/alerts/near-expiry
// @access  Private
const getNearExpiryDrugs = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;
    
    const nearExpiryDrugs = await Drug.getNearExpiry(pharmacyId)
      .sort({ expiryDate: 1 })
      .lean();

    res.json(nearExpiryDrugs);
  } catch (error) {
    console.error('Get near expiry drugs error:', error);
    res.status(500).json({ message: 'Server error while fetching near expiry drugs' });
  }
};

// @desc    Get drug statistics
// @route   GET /api/drugs/statistics
// @access  Private
const getDrugStatistics = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacy || req.user._id;

    const statistics = await Drug.aggregate([
      {
        $match: {
          pharmacy: pharmacyId,
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalDrugs: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
          lowStockCount: {
            $sum: {
              $cond: [
                { $lte: ['$quantity', '$minStockLevel'] },
                1,
                0
              ]
            }
          },
          expiredCount: {
            $sum: {
              $cond: [
                { $lt: ['$expiryDate', new Date()] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const categoryDistribution = await Drug.aggregate([
      {
        $match: {
          pharmacy: pharmacyId,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const stats = statistics[0] || {
      totalDrugs: 0,
      totalValue: 0,
      lowStockCount: 0,
      expiredCount: 0
    };

    res.json({
      summary: stats,
      categories: categoryDistribution
    });
  } catch (error) {
    console.error('Get drug statistics error:', error);
    res.status(500).json({ message: 'Server error while fetching drug statistics' });
  }
};

module.exports = {
  getDrugs,
  getDrug,
  createDrug,
  updateDrug,
  deleteDrug,
  getLowStockDrugs,
  getExpiredDrugs,
  getNearExpiryDrugs,
  getDrugStatistics
};