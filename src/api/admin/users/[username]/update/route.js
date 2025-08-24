const express = require('express');
const { param, body, validationResult } = require('express-validator');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../../middleware/middleware');

const router = express.Router();

router.put('/:username/update', [
  param('username').notEmpty().withMessage('Username is required'),
  body('role').optional().isIn(['basic', 'verified_basic', 'verified_premium', 'official', 'developer']).withMessage('Invalid role'),
  body('ban_status').optional().isBoolean().withMessage('Ban status must be boolean'),
  body('ban_release_datetime').optional().isISO8601().withMessage('Invalid date format'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be max 500 characters'),
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user._id.toString() === req.user.userId) {
      if (req.body.role !== undefined || req.body.ban_status !== undefined) {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify your own role or ban status'
        });
      }
    }

    const adminUser = await User.findById(req.user.userId);
    if (adminUser.role !== 'developer' && ['official', 'developer'].includes(user.role)) {
      if (req.body.role !== undefined || req.body.ban_status !== undefined) {
        return res.status(403).json({
          success: false,
          message: 'Only developers can modify official/developer accounts'
        });
      }
    }

    const { role, ban_status, ban_release_datetime, bio, name } = req.body;
    const updateData = {};

    const changes = [];

    if (role !== undefined && role !== user.role) {
      updateData.role = role;
      changes.push(`Role changed from ${user.role} to ${role}`);
    }

    if (ban_status !== undefined && ban_status !== user.ban_status) {
      updateData.ban_status = ban_status;
      changes.push(`Ban status changed from ${user.ban_status} to ${ban_status}`);

      if (ban_status === false) {
        updateData.ban_release_datetime = null;
        changes.push('Ban release date cleared');
      }
    }

    if (ban_release_datetime !== undefined) {
      updateData.ban_release_datetime = ban_release_datetime ? new Date(ban_release_datetime) : null;
      changes.push(`Ban release date set to ${ban_release_datetime || 'permanent'}`);
    }

    if (bio !== undefined && bio !== user.bio) {
      updateData.bio = bio;
      changes.push('Bio updated');
    }

    if (name !== undefined && name !== user.name) {
      updateData.name = name.trim();
      changes.push(`Name changed from "${user.name}" to "${name.trim()}"`);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateData,
      { new: true, select: '-password' }
    );

    console.log(`ADMIN UPDATE: Admin ${req.user.userId} updated user ${user.username}. Changes: ${changes.join(', ')}`);

    res.json({
      success: true,
      message: 'User updated successfully',
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
          google_id: updatedUser.google_id ? 'Connected' : 'Not Connected',
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at
        },
        changes,
        admin_action: {
          admin_id: req.user.userId,
          action: 'UPDATE_USER',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;