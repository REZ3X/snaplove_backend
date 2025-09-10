const express = require('express');
const { param, validationResult } = require('express-validator');
const User = require('../../../models/User');
const { getDisplayProfileImage } = require('../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:username', [
  param('username').notEmpty().withMessage('Username is required')
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

    const user = await User.findOne({ username: req.params.username })
      .select('-password -email -google_id -ban_status -ban_release_datetime');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.ban_status) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          image_profile: getDisplayProfileImage(user, req),
          role: user.role,
          bio: user.bio,
          birthdate: user.birthdate,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;