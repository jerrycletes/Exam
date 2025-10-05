const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';

function signToken(user) {
  return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

exports.signup = async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });
    const user = new User({ first_name, last_name, email, password });
    await user.save();
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, first_name, last_name, email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, first_name: user.first_name, last_name: user.last_name, email: user.email }});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
