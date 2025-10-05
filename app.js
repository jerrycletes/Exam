const express = require('express');
const cors = require('cors');
const bodyParser = require('express').json;

const authRoutes = require('./routes/auth');
const blogRoutes = require('./routes/blogs');

const app = express();
app.use(cors());
app.use(bodyParser());

app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);

// simple health
app.get('/', (req, res) => res.json({ up: true }));

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

module.exports = app;
