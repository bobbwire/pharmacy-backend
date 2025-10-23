const express = require('express');
const { body } = require('express-validator');
const {
  getDrugs,
  getDrug,
  createDrug,
  updateDrug,
  deleteDrug,
  getLowStockDrugs,
  getExpiredDrugs,
  getNearExpiryDrugs,
  getDrugStatistics
} = require('../Controllers/drugController');
const { protect } = require('../middleware/Auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const drugValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Drug name is required')
    .isLength({ min: 2 })
    .withMessage('Drug name must be at least 2 characters long'),
  
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ min: 2 })
    .withMessage('Category must be at least 2 characters long'),
  
  body('batchNo')
    .trim()
    .notEmpty()
    .withMessage('Batch number is required')
    .isLength({ min: 2 })
    .withMessage('Batch number must be at least 2 characters long'),
  
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a non-negative number'),
  
  body('expiryDate')
    .isISO8601()
    .withMessage('Valid expiry date is required')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Expiry date must be in the future');
      }
      return true;
    }),
  
  body('supplier')
    .trim()
    .notEmpty()
    .withMessage('Supplier is required')
    .isLength({ min: 2 })
    .withMessage('Supplier name must be at least 2 characters long'),
  
  body('minStockLevel')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum stock level must be at least 1')
];

// All routes are protected
router.use(protect);

// Routes
router.get('/', getDrugs);
router.get('/statistics', getDrugStatistics);
router.get('/alerts/low-stock', getLowStockDrugs);
router.get('/alerts/expired', getExpiredDrugs);
router.get('/alerts/near-expiry', getNearExpiryDrugs);
router.get('/:id', getDrug);
router.post('/', drugValidation, handleValidationErrors, createDrug);
router.put('/:id', drugValidation, handleValidationErrors, updateDrug);
router.delete('/:id', deleteDrug);

module.exports = router;