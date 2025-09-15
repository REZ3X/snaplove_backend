const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../../../models/User');
const mailService = require('../../../services/mailService');

const router = express.Router();

router.post('/', [
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

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {

      return res.json({
        success: true,
        message: 'If an account with that email exists and is unverified, a verification email has been sent.'
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified.',
        already_verified: true
      });
    }

    const verificationToken = mailService.generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); 
    user.email_verification_token = verificationToken;
    user.email_verification_expires = verificationExpires;
    await user.save();

    try {
      await mailService.sendVerificationEmail(user.email, user.name, verificationToken, user.username);
      console.log(`📧 Resent verification email to ${user.email} for user @${user.username}`);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'Verification email has been resent. Please check your inbox.',
      verification_expires: verificationExpires.toISOString()
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;