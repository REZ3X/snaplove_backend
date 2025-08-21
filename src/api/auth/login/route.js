const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');

const router = express.Router();

router.post('/', [
  body('google_id').notEmpty().withMessage('Google ID is required'),
  body('email').isEmail().withMessage('Valid email is required')
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

    const { google_id, email } = req.body;


    let user = await User.findOne({ google_id });
    
    if (!user) {
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please register first.'
      });
    }

    if (user.ban_status) {
      const now = new Date();
      if (user.ban_release_datetime && now < user.ban_release_datetime) {
        return res.status(403).json({
          success: false,
          message: 'Account is banned',
          ban_release_datetime: user.ban_release_datetime
        });
      } else if (user.ban_release_datetime && now >= user.ban_release_datetime) {
        user.ban_status = false;
        user.ban_release_datetime = null;
        await user.save();
      } else {
        return res.status(403).json({
          success: false,
          message: 'Account is permanently banned'
        });
      }
    }


    if (!user.google_id || user.google_id !== google_id) {
      user.google_id = google_id;
      await user.save();
    }

    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          image_profile: user.image_profile,
          role: user.role,
          bio: user.bio,
          ban_status: user.ban_status
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;