const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET;

async function authenticate(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next(); // allow unauthenticated access for public endpoints; protect routes check explicitly
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select('-password');
    if (!user) {
      req.user = null;
      return next();
    }
    req.user = user;
    next();
  } catch (err) {
    // expired or invalid token -> treat as unauthenticated
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  next();
}

module.exports = { authenticate, requireAuth };
