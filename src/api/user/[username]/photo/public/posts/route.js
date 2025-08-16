const express = require('express');
const { param, query, validationResult } = require('express-validator');
const PhotoPost = require('../../../../../../models/PhotoPost');
const User = require('../../../../../../models/User');

const router = express.Router();

router.get('/:username', [
  param('username').notEmpty().withMessage('Username is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await PhotoPost.find({ 
      user_id: targetUser._id,
      posted: true
    })
      .populate('template_frame_id', 'title layout_type official_status')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PhotoPost.countDocuments({ 
      user_id: targetUser._id,
      posted: true
    });
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          image_profile: targetUser.image_profile,
          role: targetUser.role
        },
        posts: posts.map(post => ({
          id: post._id,
          images: post.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: post.title,
          desc: post.desc,
          total_likes: post.total_likes,
          tag_label: post.tag_label,
          template_frame: post.template_frame_id ? {
            id: post.template_frame_id._id,
            title: post.template_frame_id.title,
            layout_type: post.template_frame_id.layout_type,
            official_status: post.template_frame_id.official_status
          } : null,
          created_at: post.created_at,
          updated_at: post.updated_at
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
    console.error('Get user public posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;