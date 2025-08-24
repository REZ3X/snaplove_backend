const express = require('express');
const { query, validationResult } = require('express-validator');
const User = require('../../../models/User');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../middleware/middleware');

const router = express.Router();

router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['basic', 'verified_basic', 'verified_premium', 'official', 'developer']).withMessage('Invalid role'),
  query('ban_status').optional().isBoolean().withMessage('Ban status must be boolean'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sort').optional().isIn(['newest', 'oldest', 'name_asc', 'name_desc', 'username_asc', 'username_desc']).withMessage('Invalid sort option')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.ban_status !== undefined) {
      filter.ban_status = req.query.ban_status === 'true';
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { username: searchRegex },
        { email: searchRegex }
      ];
    }

    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { created_at: 1 };
        break;
      case 'name_asc':
        sort = { name: 1 };
        break;
      case 'name_desc':
        sort = { name: -1 };
        break;
      case 'username_asc':
        sort = { username: 1 };
        break;
      case 'username_desc':
        sort = { username: -1 };
        break;
      default:
        sort = { created_at: -1 };
    }

    const users = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const banStats = await User.aggregate([
      { $group: { _id: '$ban_status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          image_profile: user.image_profile,
          role: user.role,
          bio: user.bio,
          birthdate: user.birthdate,
          ban_status: user.ban_status,
          ban_release_datetime: user.ban_release_datetime,
          google_id: user.google_id ? 'Connected' : 'Not Connected',
          created_at: user.created_at,
          updated_at: user.updated_at
        })),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        statistics: {
          role_distribution: roleStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
          ban_distribution: banStats.reduce((acc, stat) => {
            acc[stat._id ? 'banned' : 'active'] = stat.count;
            return acc;
          }, {}),
          total_users: total
        }
      }
    });

  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;