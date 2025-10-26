const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Attempt to connect using the environment variable
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
