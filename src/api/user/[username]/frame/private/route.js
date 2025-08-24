const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');

const router = express.Router();

router.get('/:username', [
  param('username').notEmpty().withMessage('Username is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own private frames.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const frames = await Frame.find({
      user_id: targetUser._id,
      visibility: 'private'
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Frame.countDocuments({
      user_id: targetUser._id,
      visibility: 'private'
    });
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        frames: frames.map(frame => ({
          id: frame._id,
          images: frame.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: frame.title,
          desc: frame.desc,
          total_likes: frame.total_likes,
          total_uses: frame.total_uses,
          layout_type: frame.layout_type,
          official_status: frame.official_status,
          visibility: frame.visibility,
          tag_label: frame.tag_label,
          created_at: frame.created_at,
          updated_at: frame.updated_at
        })),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get private frames error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;