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
const frameAdminDeleteRoute = require('./api/frame/public/[id]/admin/delete/route');


const postPublicRoute = require('./api/post/public/route');
const postByIdRoute = require('./api/post/public/[id]/route');
const postLikeRoute = require('./api/post/public/[id]/like/route');
const postAdminDeleteRoute = require('./api/post/public/[id]/delete/route');
const userPhotoPrivateRoute = require('./api/user/[username]/photo/private/route');
const userPhotoPublicPostsRoute = require('./api/user/[username]/photo/public/posts/route');
const photoPrivateDetailRoute = require('./api/user/[username]/photo/private/[id]/route');
const photoEditRoute = require('./api/user/[username]/photo/private/[id]/edit/route');
const photoDeleteRoute = require('./api/user/[username]/photo/private/[id]/delete/route');


const adminUsersRoute = require('./api/admin/users/route');
const adminUserDetailRoute = require('./api/admin/users/[username]/route');
const adminUserUpdateRoute = require('./api/admin/users/[username]/update/route');
const adminUserDeleteRoute = require('./api/admin/users/[username]/delete/route');


const userTicketPrivateRoute = require('./api/user/[username]/ticket/private/route');
const userTicketDetailRoute = require('./api/user/[username]/ticket/private/[id]/route');
const adminTicketRoute = require('./api/admin/ticket/route');
const adminTicketDetailRoute = require('./api/admin/ticket/[id]/route');

const app = express();
const PORT = process.env.PORT || 3000;

const imageHandler = require('./utils/LocalImageHandler');
imageHandler.initializeDirectories();


if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'your-frontend-domain.com' : '*',
  credentials: true
}));

app.use('/images', express.static(path.join(process.cwd(), 'images')));


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: process.env.NODE_ENV === 'test' ? 1000000 : 100, 
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  skip: process.env.NODE_ENV === 'test' ? () => true : () => false 
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000000 : 5, 
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  skip: process.env.NODE_ENV === 'test' ? () => true : () => false 
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
app.use('/api/frame/public', frameAdminDeleteRoute);


app.use('/api/user', userFramePrivateRoute);
app.use('/api/user', userFramePublicRoute);
app.use('/api/user', frameEditRoute);
app.use('/api/user', framePrivateDetailRoute);
app.use('/api/user', frameDeleteRoute);


app.use('/api/post/public', postPublicRoute);
app.use('/api/post/public', postByIdRoute);
app.use('/api/post/public', postLikeRoute);
app.use('/api/post/public', postAdminDeleteRoute);


app.use('/api/user', userPhotoPrivateRoute);
app.use('/api/user', userPhotoPublicPostsRoute);
app.use('/api/user', photoPrivateDetailRoute);
app.use('/api/user', photoEditRoute);
app.use('/api/user', photoDeleteRoute);


app.use('/api/admin/users', adminUsersRoute);
app.use('/api/admin/users', adminUserDetailRoute);
app.use('/api/admin/users', adminUserUpdateRoute);
app.use('/api/admin/users', adminUserDeleteRoute);


app.use('/api/user', userTicketPrivateRoute);
app.use('/api/user', userTicketDetailRoute);


app.use('/api/admin/ticket', adminTicketRoute);
app.use('/api/admin/ticket', adminTicketDetailRoute);

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


if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Snaplove Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📁 Images served from: ${path.join(process.cwd(), 'images')}`);
  });
}

module.exports = app;