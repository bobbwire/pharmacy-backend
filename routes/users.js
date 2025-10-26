const express = require('express');
const { body } = require('express-validator');
const { 
  getUserProfile, 
  updateUserProfile, 
  changePassword, 
  updatePreferences 
} = require('../Controllers/userController');
const { protect } = require('../Middleware/auth.js');
const { handleValidationErrors } = require('../Middleware/validation');

const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('username')
    .optional()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long')
    .isAlphanumeric()
    .withMessage('Username can only contain letters and numbers'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('pharmacyName')
    .optional()
    .notEmpty()
    .withMessage('Pharmacy name cannot be empty')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
];

// All routes are protected
router.use(protect);

// Routes
router.get('/profile', getUserProfile);
router.put('/profile', updateProfileValidation, handleValidationErrors, updateUserProfile);
router.put('/password', changePasswordValidation, handleValidationErrors, changePassword);
router.put('/preferences', updatePreferences);

module.exports = router;
