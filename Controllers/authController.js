const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT Token (never expires)
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'defaultsecret' // ✅ No expiresIn → never expires
  );
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password, pharmacyName, phone } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (userExists) {
      return res.status(400).json({
        message:
          userExists.email === email
            ? 'Email already registered'
            : 'Username already taken'
      });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      pharmacyName,
      phone,
      role: 'admin' // First user becomes admin
    });

    if (user) {
      // Update last login
      await user.updateLastLogin();

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        pharmacyName: user.pharmacyName,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id),
        preferences: user.preferences
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check for user by email or username
    const user = await User.findOne({
      $or: [{ email: username }, { username }]
    });

    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      // Update last login
      await user.updateLastLogin();

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        pharmacyName: user.pharmacyName,
        phone: user.phone,
        role: user.role,
        lastLogin: user.lastLogin,
        token: generateToken(user._id),
        preferences: user.preferences
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe
};
