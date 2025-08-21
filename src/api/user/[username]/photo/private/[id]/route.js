const express = require('express');
const { param, validationResult } = require('express-validator');
const PhotoPost = require('../../../../../../models/PhotoPost');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware');

const router = express.Router();

router.get('/:username/photo/private/:id', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid photo ID')
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
        message: 'Access denied. You can only view your own private photos.'
      });
    }

    const photo = await PhotoPost.findOne({ 
      _id: req.params.id,
      user_id: targetUser._id,
      posted: false
    })
      .populate('user_id', 'name username image_profile role')
      .populate('template_frame_id', 'title layout_type official_status images');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Private photo not found'
      });
    }

    res.json({
      success: true,
      data: {
        photo: {
          id: photo._id,
          images: photo.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: photo.title,
          desc: photo.desc,
          total_likes: photo.total_likes,
          tag_label: photo.tag_label,
          posted: photo.posted,
          template_frame: photo.template_frame_id ? {
            id: photo.template_frame_id._id,
            title: photo.template_frame_id.title,
            layout_type: photo.template_frame_id.layout_type,
            official_status: photo.template_frame_id.official_status,
            images: photo.template_frame_id.images.map(img => req.protocol + '://' + req.get('host') + '/' + img)
          } : null,
          user: {
            id: photo.user_id._id,
            name: photo.user_id.name,
            username: photo.user_id.username,
            image_profile: photo.user_id.image_profile,
            role: photo.user_id.role
          },
          created_at: photo.created_at,
          updated_at: photo.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get private photo by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;