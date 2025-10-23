const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.pharmacyName = req.body.pharmacyName || user.pharmacyName;
      user.phone = req.body.phone || user.phone;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        pharmacyName: updatedUser.pharmacyName,
        phone: updatedUser.phone,
        role: updatedUser.role,
        preferences: updatedUser.preferences
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      res.status(400).json({ message: `${field} already exists` });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
};

// @desc    Change password
// @route   PUT /api/users/password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (user && (await user.matchPassword(currentPassword))) {
      user.password = newPassword;
      await user.save();
      
      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(400).json({ message: 'Current password is incorrect' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
const updatePreferences = async (req, res) => {
  try {
    const { lowStockAlerts, expiryAlerts, emailReports, soundNotifications } = req.body;
    
    const user = await User.findById(req.user.id);

    if (user) {
      user.preferences = {
        lowStockAlerts: lowStockAlerts !== undefined ? lowStockAlerts : user.preferences.lowStockAlerts,
        expiryAlerts: expiryAlerts !== undefined ? expiryAlerts : user.preferences.expiryAlerts,
        emailReports: emailReports !== undefined ? emailReports : user.preferences.emailReports,
        soundNotifications: soundNotifications !== undefined ? soundNotifications : user.preferences.soundNotifications
      };

      const updatedUser = await user.save();

      res.json({ 
        message: 'Preferences updated successfully',
        preferences: updatedUser.preferences 
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  changePassword,
  updatePreferences
};