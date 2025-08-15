require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./lib/mongodb');

const loginRoute = require('./api/auth/login/route');
const registerRoute = require('./api/auth/register/route');
const logoutRoute = require('./api/auth/logout/route');
const meRoute = require('./api/auth/me/route');

const framePublicRoute = require('./api/frame/public/route');
const frameByIdRoute = require('./api/frame/public/[id]/route');
const frameLikeRoute = require('./api/frame/public/[id]/like/route');
const userFramePrivateRoute = require('./api/user/[username]/frame/private/route');
const userFramePublicRoute = require('./api/user/[username]/frame/public/route');
const frameEditRoute = require('./api/user/[username]/frame/private/[id]/edit/route');
const framePrivateDetailRoute = require('./api/user/[username]/frame/private/[id]/route');
const frameDeleteRoute = require('./api/user/[username]/frame/private/[id]/delete/route');

const app = express();
const PORT = process.env.PORT || 3000;

const imageHandler = require('./utils/LocalImageHandler');
imageHandler.initializeDirectories();

connectDB();

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'your-frontend-domain.com' : '*',
  credentials: true
}));

app.use('/images', express.static(path.join(process.cwd(), 'images')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   max: 5, 
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Snaplove Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.use('/api/auth/login', authLimiter, loginRoute);
app.use('/api/auth/register', authLimiter, registerRoute);
app.use('/api/auth/logout', logoutRoute);
app.use('/api/auth/me', meRoute);

app.use('/api/frame/public', framePublicRoute);
app.use('/api/frame/public', frameByIdRoute);
app.use('/api/frame/public', frameLikeRoute);

app.use('/api/user', userFramePrivateRoute);
app.use('/api/user', userFramePublicRoute);
app.use('/api/user', frameEditRoute);
app.use('/api/user', framePrivateDetailRoute);
app.use('/api/user', frameDeleteRoute);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

app.use((err, req, res, _next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Snaplove Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Images served from: ${path.join(process.cwd(), 'images')}`);
});

module.exports = app;