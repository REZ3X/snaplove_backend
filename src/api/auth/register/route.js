const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const { getDisplayProfileImage } = require('../../../utils/profileImageHelper');
// const mailService = require('../../../services/mailService'); // DISABLED FOR TESTING

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

    // DISABLED EMAIL VERIFICATION FOR TESTING
    // const verificationToken = mailService.generateVerificationToken();
    // const verificationExpires = new Date();
    // verificationExpires.setHours(verificationExpires.getHours() + 24);
    
    const newUser = new User({
      google_id,
      email,
      name,
      username: finalUsername,
      image_profile: image_profile || null,
      role: 'basic',
      ban_status: false,
      // TESTING: Auto-verify new users
      email_verified: true,
      email_verified_at: new Date(),
      email_verification_token: null,
      email_verification_expires: null
    });

    await newUser.save();

    // DISABLED EMAIL SENDING FOR TESTING
    // try {
    //   await mailService.sendVerificationEmail(email, name, verificationToken, finalUsername);
    //   console.log(`📧 Verification email sent to ${email} for user @${finalUsername}`);
    // } catch (emailError) {
    //   console.error('Failed to send verification email:', emailError);
    // }

    console.log(`✅ TESTING MODE: Auto-verified user @${finalUsername} (${email})`);

    // Generate JWT token immediately for testing
    const token = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email,
        role: newUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully and auto-verified for testing.',
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
          email_verified_at: newUser.email_verified_at,
          created_at: newUser.created_at,
          updated_at: newUser.updated_at
        },
        token, // Include token for immediate login
        // DISABLED FOR TESTING
        // requires_verification: true,
        // verification_expires: verificationExpires.toISOString()
        requires_verification: false, // Testing: no verification needed
        auto_verified: true // Testing flag
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