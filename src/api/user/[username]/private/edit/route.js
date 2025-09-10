const express = require('express');
const { param, body, validationResult } = require('express-validator');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');

const router = express.Router();

router.put('/:username/private/edit', [
  param('username').notEmpty().withMessage('Username is required'),
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be max 500 characters'),
  body('birthdate').optional().isISO8601().withMessage('Invalid birthdate format (use YYYY-MM-DD)')
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
        message: 'Access denied. You can only edit your own profile.'
      });
    }

    const { name, bio, birthdate } = req.body;
    const updateData = {};
    const changes = [];

    if (name !== undefined && name.trim() !== targetUser.name) {
      updateData.name = name.trim();
      changes.push(`Name changed from "${targetUser.name}" to "${name.trim()}"`);
    }

    if (bio !== undefined && bio !== targetUser.bio) {
      updateData.bio = bio;
      changes.push('Bio updated');
    }

    if (birthdate !== undefined) {
      const newBirthdate = birthdate ? new Date(birthdate) : null;

      if (newBirthdate && newBirthdate > new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Birthdate cannot be in the future'
        });
      }

      const currentBirthdate = targetUser.birthdate ? targetUser.birthdate.toISOString().split('T')[0] : null;
      const newBirthdateString = newBirthdate ? newBirthdate.toISOString().split('T')[0] : null;

      if (currentBirthdate !== newBirthdateString) {
        updateData.birthdate = newBirthdate;
        changes.push(`Birthdate ${newBirthdate ? 'updated' : 'removed'}`);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      targetUser._id,
      updateData,
      { new: true, select: '-password -google_id' }
    );

    console.log(`USER UPDATE: User ${targetUser.username} updated their profile. Changes: ${changes.join(', ')}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          username: updatedUser.username,
          email: updatedUser.email,
          image_profile: updatedUser.image_profile,
          role: updatedUser.role,
          bio: updatedUser.bio,
          birthdate: updatedUser.birthdate,
          ban_status: updatedUser.ban_status,
          ban_release_datetime: updatedUser.ban_release_datetime,
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at
        },
        changes
      }
    });

  } catch (error) {
    console.error('Edit profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;