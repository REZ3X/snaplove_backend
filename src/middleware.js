const jwt = require('jsonwebtoken');
const User = require('./models/User');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user || !['official', 'developer'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const checkBanStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.ban_status) {
      const now = new Date();
      if (user.ban_release_datetime && now >= user.ban_release_datetime) {
        user.ban_status = false;
        user.ban_release_datetime = null;
        await user.save();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Account is banned',
          ban_release_datetime: user.ban_release_datetime
        });
      }
    }
    
    req.currentUser = user;
    next();
  } catch (error) {
    console.error('Ban check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  checkBanStatus
};