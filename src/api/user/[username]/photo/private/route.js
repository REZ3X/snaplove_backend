const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Photo = require('../../../../../models/Photo');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');

const router = express.Router();

router.get('/:username/photo/private', [
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
        message: 'Access denied. You can only view your own photos.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const photos = await Photo.find({
      user_id: targetUser._id
    })
      .populate('frame_id', 'title layout_type thumbnail')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Photo.countDocuments({
      user_id: targetUser._id
    });
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        photos: photos.map(photo => ({
          id: photo._id,
          images: photo.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: photo.title,
          desc: photo.desc,
          frame: {
            id: photo.frame_id._id,
            title: photo.frame_id.title,
            layout_type: photo.frame_id.layout_type,
            thumbnail: photo.frame_id.thumbnail ? req.protocol + '://' + req.get('host') + '/' + photo.frame_id.thumbnail : null
          },
          expires_at: photo.expires_at,
          created_at: photo.created_at,
          updated_at: photo.updated_at
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
    console.error('Get private photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;