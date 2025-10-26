const express = require('express');
const Sale = require('../models/Sale');
const Drug = require('../models/Drug');
const { protect } = require('../Middleware/auth');

const router = express.Router();

// @desc Create new sale
router.post('/', protect, async (req, res) => {
  try {
    const { items, paymentMethod, customerName, customerPhone } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Sale must have at least one item' });
    }

    const saleItems = [];
    let totalAmount = 0;
    let totalItems = 0;

    // Process each item and update drug quantities
    for (const item of items) {
      const drug = await Drug.findById(item.drugId);
      if (!drug) {
        return res.status(404).json({ message: `Drug not found: ${item.drugId}` });
      }

      if (drug.quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${drug.name}. Available: ${drug.quantity}, Requested: ${item.quantity}` 
        });
      }

      const totalPrice = drug.price * item.quantity;
      totalAmount += totalPrice;
      totalItems += item.quantity;

      // Update drug quantity - THIS IS THE KEY PART
      drug.quantity -= item.quantity;
      await drug.save();

      saleItems.push({
        drug: drug._id,
        drugName: drug.name,
        batchNo: drug.batchNo,
        category: drug.category,
        quantity: item.quantity,
        unitPrice: drug.price,
        totalPrice: totalPrice
      });
    }

    // Create sale record
    const sale = new Sale({
      items: saleItems,
      totalAmount,
      totalItems,
      paymentMethod: paymentMethod || 'cash',
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      soldBy: req.user._id
    });

    await sale.save();

    // Populate sale for response
    const populatedSale = await Sale.findById(sale._id)
      .populate('soldBy', 'username name')
      .populate('items.drug', 'name batchNo category');

    res.status(201).json({
      message: 'Sale completed successfully',
      sale: populatedSale
    });

  } catch (error) {
    console.error('Sale creation error:', error);
    res.status(500).json({ 
      message: 'Server error processing sale', 
      error: error.message 
    });
  }
});

// @desc Get all sales
router.get('/', protect, async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate('soldBy', 'username name')
      .sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ 
      message: 'Server error fetching sales', 
      error: error.message 
    });
  }
});

// @desc Get sale by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('soldBy', 'username name')
      .populate('items.drug', 'name batchNo category');
      
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    res.json(sale);
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ 
      message: 'Error fetching sale', 
      error: error.message 
    });
  }
});

module.exports = router;
