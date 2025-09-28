const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { getDisplayProfileImage } = require('../../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:username/liked/private', [
  param('username').notEmpty().withMessage('Username is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('sort').optional().isIn(['newest', 'oldest', 'most_liked', 'most_used']).withMessage('Invalid sort option'),
  query('approval_status').optional().isIn(['approved', 'pending', 'rejected', 'all']).withMessage('Invalid approval status filter')
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
        message: 'Access denied. You can only view your own liked frames.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {
      'like_count.user_id': targetUser._id,
      visibility: 'public'
    };

    const approvalFilter = req.query.approval_status || 'approved';
    if (approvalFilter !== 'all') {
      filter.approval_status = approvalFilter;
    }

    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { created_at: 1 };
        break;
      case 'most_liked':
        sort = { total_likes: -1, created_at: -1 };
        break;
      case 'most_used':
        sort = { total_uses: -1, created_at: -1 };
        break;
      case 'newest':
      default:
        sort = { created_at: -1 };
    }

    const frames = await Frame.find(filter)
      .populate('user_id', 'name username image_profile role custom_profile_image use_google_profile')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Frame.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const processedFrames = frames.map(frame => {
      const frameObj = frame.toObject();
      
      return {
        ...frameObj,
        images: frameObj.images?.map(img => 
          img.startsWith('http') ? img : `${req.protocol}://${req.get('host')}/${img}`
        ) || [],
        thumbnail: frameObj.thumbnail ? 
          (frameObj.thumbnail.startsWith('http') ? frameObj.thumbnail : `${req.protocol}://${req.get('host')}/${frameObj.thumbnail}`) 
          : null,
        user_id: {
          ...frameObj.user_id,
          image_profile: getDisplayProfileImage(frameObj.user_id, req)
        }
      };
    });

    res.json({
      success: true,
      message: 'Liked frames retrieved successfully',
      data: {
        frames: processedFrames,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        statistics: {
          total_liked_frames: total,
          approved_frames: await Frame.countDocuments({
            ...filter,
            approval_status: 'approved'
          }),
          pending_frames: await Frame.countDocuments({
            ...filter,
            approval_status: 'pending'
          })
        }
      }
    });

  } catch (error) {
    console.error('Get user liked frames error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug_info: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:username/liked/private/check/:frameId', [
  param('username').notEmpty().withMessage('Username is required'),
  param('frameId').isMongoId().withMessage('Invalid frame ID')
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
        message: 'Access denied. You can only check your own likes.'
      });
    }

    const frame = await Frame.findOne({
      _id: req.params.frameId,
      visibility: 'public'
    });

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const isLiked = frame.like_count.some(like => 
      like.user_id.toString() === targetUser._id.toString()
    );

    res.json({
      success: true,
      data: {
        is_liked: isLiked,
        frame_id: req.params.frameId,
        user_id: targetUser._id
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;