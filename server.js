require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log('Listening on', PORT));
  })
  .catch(err => {
    console.error('DB connection error', err);
    process.exit(1);
  });
