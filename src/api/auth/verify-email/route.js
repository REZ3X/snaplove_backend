const express = require('express');
const { query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { getDisplayProfileImage } = require('../../../utils/profileImageHelper');
const mailService = require('../../../services/mailService');

const router = express.Router();

router.get('/', [
  query('token').notEmpty().withMessage('Verification token is required'),
  query('username').notEmpty().withMessage('Username is required')
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

    const { token, username } = req.query;

    const user = await User.findOne({
      username,
      email_verification_token: token
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token or username.'
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified.',
        already_verified: true
      });
    }

    if (new Date() > user.email_verification_expires) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please register again.',
        expired: true
      });
    }

    user.email_verified = true;
    user.email_verified_at = new Date();
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save();

    console.log(`✅ Email verified for user @${user.username} (${user.email})`);

    try {
      await mailService.sendWelcomeEmail(user.email, user.name, user.username);
      console.log(`📧 Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);

    }

    const jwtToken = jwt.sign(
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
      message: 'Email verified successfully! Welcome to Snaplove!',
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
        token: jwtToken,
        verified_at: user.email_verified_at
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;