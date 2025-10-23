// generateToken.js
const jwt = require('jsonwebtoken');

// Replace this with your MongoDB User ID
const userId = '6715f9cfb3b7b235d9f6aabc';

// Replace with your actual JWT secret (same as in .env)
const secret = 'yourSuperSecretKey';

// Generate token (no expiry)
const token = jwt.sign({ id: userId }, secret);

console.log('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MTVmOWNmYjNiN2IyMzVkOWY2YWFiYyIsImlhdCI6MTc2MDk3MzY3MX0.ndUNy2ENW-jvx6EQs8i1TQ_jQpZdRsG6IR5Horz7IIA:');
console.log(token);
