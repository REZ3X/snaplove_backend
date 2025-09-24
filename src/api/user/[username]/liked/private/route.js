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

    const approvalFilter = req.query.approval_status || 'all';
    if (approvalFilter !== 'all') {
      filter.approval_status = approvalFilter;
    }

    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { 'like_count.created_at': 1 };
        break;
      case 'most_liked':
        sort = { 'like_count': -1, created_at: -1 };
        break;
      case 'most_used':
        sort = { 'use_count': -1, created_at: -1 };
        break;
      default:
        sort = { 'like_count.created_at': -1 };
    }

    const frames = await Frame.find(filter)
      .populate('user_id', 'name username image_profile role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Frame.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const stats = await Frame.aggregate([
      {
        $match: {
          'like_count.user_id': targetUser._id,
          visibility: 'public'
        }
      },
      {
        $group: {
          _id: '$approval_status',
          count: { $sum: 1 },
          total_likes: { $sum: { $size: '$like_count' } },
          total_uses: { $sum: { $size: '$use_count' } }
        }
      }
    ]);

    const processedFrames = frames.map(frame => {
      const userLike = frame.like_count.find(like =>
        like.user_id.toString() === targetUser._id.toString()
      );

      let thumbnailUrl;
      if (frame.thumbnail && !frame.thumbnail.endsWith('.svg')) {
        thumbnailUrl = req.protocol + '://' + req.get('host') + '/' + frame.thumbnail;
      } else if (frame.images && frame.images.length > 0) {
        thumbnailUrl = req.protocol + '://' + req.get('host') + '/' + frame.images[0];
      } else {
        thumbnailUrl = null;
      }

      return {
        id: frame._id,
        thumbnail: thumbnailUrl,
        title: frame.title,
        desc: frame.desc.length > 150 ? frame.desc.substring(0, 150) + '...' : frame.desc,
        total_likes: frame.total_likes,
        total_uses: frame.total_uses,
        layout_type: frame.layout_type,
        official_status: frame.official_status,
        approval_status: frame.approval_status,
        is_shadow_banned: frame.approval_status !== 'approved',
        tag_label: frame.tag_label,
        user: {
          id: frame.user_id._id,
          name: frame.user_id.name,
          username: frame.user_id.username,
          image_profile: getDisplayProfileImage(frame.user_id, req),
          role: frame.user_id.role
        },
        liked_at: userLike ? userLike.created_at : null,
        created_at: frame.created_at,
        updated_at: frame.updated_at
      };
    });

    res.json({
      success: true,
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          image_profile: getDisplayProfileImage(targetUser, req),
          role: targetUser.role
        },
        liked_frames: processedFrames,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        statistics: {
          total_liked: stats.reduce((sum, s) => sum + s.count, 0),
          approved: stats.find(s => s._id === 'approved')?.count || 0,
          pending: stats.find(s => s._id === 'pending')?.count || 0,
          rejected: stats.find(s => s._id === 'rejected')?.count || 0,
          breakdown: stats.map(stat => ({
            approval_status: stat._id,
            count: stat.count,
            avg_likes: stat.count > 0 ? Math.round(stat.total_likes / stat.count * 100) / 100 : 0,
            avg_uses: stat.count > 0 ? Math.round(stat.total_uses / stat.count * 100) / 100 : 0
          }))
        }
      }
    });

  } catch (error) {
    console.error('Get user liked frames error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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

    const userLike = frame.like_count.find(like =>
      like.user_id.toString() === targetUser._id.toString()
    );

    res.json({
      success: true,
      data: {
        frame_id: frame._id,
        is_liked: !!userLike,
        liked_at: userLike ? userLike.created_at : null,
        total_likes: frame.total_likes
      }
    });

  } catch (error) {
    console.error('Check frame like status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;