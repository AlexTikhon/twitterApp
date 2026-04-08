const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/auth');
const feedRoutes = require('./routes/feed');

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const mongoDbUri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

app.use('/auth', authRoutes);
app.use('/feed', feedRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  void next;

  const status = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const data = error.data || null;

  res.status(status).json({
    message,
    data
  });
});

if (!mongoDbUri) {
  throw new Error('MONGODB_URI is missing. Add it to your .env file.');
}

const startServer = async () => {
  try {
    await mongoose.connect(mongoDbUri);
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err);
  }
};

startServer();
