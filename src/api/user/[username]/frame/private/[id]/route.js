const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../../../models/Frame');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware/middleware');
const { getDisplayProfileImage } = require('../../../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:username/frame/private/:id', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid frame ID')
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

    const frame = await Frame.findOne({
      _id: req.params.id,
      user_id: targetUser._id,
      visibility: 'private'
    }).populate('user_id', 'name username image_profile role');

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Private frame not found'
      });
    }

    res.json({
      success: true,
      data: {
        frame: {
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
          user: {
            id: frame.user_id._id,
            name: frame.user_id.name,
            username: frame.user_id.username,
  image_profile: getDisplayProfileImage(frame.user_id, req),
            role: frame.user_id.role
          },
          created_at: frame.created_at,
          updated_at: frame.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get private frame by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;