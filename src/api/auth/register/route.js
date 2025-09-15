const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../../../models/User');
const { getDisplayProfileImage } = require('../../../utils/profileImageHelper');
const mailService = require('../../../services/mailService');

const router = express.Router();

router.post('/', [
  body('google_id').notEmpty().withMessage('Google ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('image_profile').optional().isURL().withMessage('Invalid image URL')
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

    const { google_id, email, name, image_profile } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { google_id }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    const username = email.replace('@gmail.com', '').replace('@', '_');

    let finalUsername = username;
    let counter = 1;
    while (await User.findOne({ username: finalUsername })) {
      finalUsername = `${username}${counter}`;
      counter++;
    }

    const verificationToken = mailService.generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); 
    const newUser = new User({
      google_id,
      email,
      name,
      username: finalUsername,
      image_profile: image_profile || null,
      role: 'basic',
      ban_status: false,

      email_verified: false,
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires
    });

    await newUser.save();

    try {
      await mailService.sendVerificationEmail(email, name, verificationToken, finalUsername);
      console.log(`📧 Verification email sent to ${email} for user @${finalUsername}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);

    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          image_profile: getDisplayProfileImage(newUser, req),
          role: newUser.role,
          bio: newUser.bio,
          birthdate: newUser.birthdate,
          ban_status: newUser.ban_status,
          ban_release_datetime: newUser.ban_release_datetime,
          use_google_profile: newUser.use_google_profile !== false,
          has_custom_image: !!newUser.custom_profile_image,
          email_verified: newUser.email_verified,
          created_at: newUser.created_at,
          updated_at: newUser.updated_at
        },
        requires_verification: true,
        verification_expires: verificationExpires.toISOString()
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;