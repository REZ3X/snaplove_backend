const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { getDisplayProfileImage } = require('../../../utils/profileImageHelper');

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

    // DISABLED EMAIL VERIFICATION CHECK FOR TESTING
    // if (!user.email_verified) {
    //   if (user.email_verification_expires && new Date() > user.email_verification_expires) {
    //     return res.status(403).json({
    //       success: false,
    //       message: 'Email verification expired. Please register again.',
    //       requires_new_registration: true
    //     });
    //   }

    //   return res.status(403).json({
    //     success: false,
    //     message: 'Please verify your email address before logging in. Check your inbox for verification instructions.',
    //     requires_verification: true,
    //     email: user.email
    //   });
    // }

    // TESTING: Auto-verify existing unverified users
    if (!user.email_verified) {
      user.email_verified = true;
      user.email_verified_at = new Date();
      user.email_verification_token = null;
      user.email_verification_expires = null;
      await user.save();
      console.log(`✅ TESTING MODE: Auto-verified existing user @${user.username} (${user.email})`);
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
          image_profile: getDisplayProfileImage(user, req),
          role: user.role,
          bio: user.bio,
          ban_status: user.ban_status,
          email_verified: user.email_verified,
          email_verified_at: user.email_verified_at
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