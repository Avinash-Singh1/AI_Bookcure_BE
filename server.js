require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chat.routes');
const searchRoutes = require('./routes/search.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:4200',
// }));
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:4400'
  ],
  credentials: true
}));
// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests, please try again later.' },
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', chatRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Start
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
