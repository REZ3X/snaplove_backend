const express = require('express');
const { param, body, validationResult } = require('express-validator');
const User = require('../../../../../models/User');
const Frame = require('../../../../../models/Frame');
const Photo = require('../../../../../models/Photo');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../../middleware');
const imageHandler = require('../../../../../utils/LocalImageHandler');

const router = express.Router();

router.delete('/:username/delete', [
  param('username').notEmpty().withMessage('Username is required'),
  body('confirm_deletion').equals('DELETE').withMessage('Must confirm deletion with "DELETE"'),
  body('reason').optional().isLength({ min: 1, max: 500 }).withMessage('Reason must be 1-500 characters')
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
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const adminUser = await User.findById(req.user.userId);
    if (adminUser.role !== 'developer' && ['official', 'developer'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only developers can delete official/developer accounts'
      });
    }

    const [userFrames, userPhotos] = await Promise.all([
      Frame.find({ user_id: user._id }).select('images'),
      Photo.find({ user_id: user._id }).select('images')
    ]);

    const deletionData = {
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      },
      content_counts: {
        frames: userFrames.length,
        photos: userPhotos.length,
        total_images: userFrames.reduce((sum, frame) => sum + frame.images.length, 0) +
          userPhotos.reduce((sum, photo) => sum + photo.images.length, 0)
      },
      reason: req.body.reason || 'No reason provided'
    };

    const allImages = [
      ...userFrames.flatMap(frame => frame.images),
      ...userPhotos.flatMap(post => post.images)
    ];

    const imageDeletePromises = allImages.map(async (imagePath) => {
      try {
        await imageHandler.deleteImage(imagePath);
      } catch (error) {
        console.error(`Failed to delete image ${imagePath}:`, error);
      }
    });

    await Promise.allSettled(imageDeletePromises);

    await Promise.all([
      Frame.deleteMany({ user_id: user._id }),
      Photo.deleteMany({ user_id: user._id })
    ]);

    await Promise.all([
      Frame.updateMany(
        { 'like_count.user_id': user._id },
        { $pull: { like_count: { user_id: user._id } } }
      ),
      Frame.updateMany(
        { 'use_count.user_id': user._id },
        { $pull: { use_count: { user_id: user._id } } }
      ),
      Photo.updateMany(
        { 'like_count.user_id': user._id },
        { $pull: { like_count: { user_id: user._id } } }
      )
    ]);

    await User.findByIdAndDelete(user._id);

    console.log(`ADMIN DELETE: Admin ${req.user.userId} deleted user ${user.username}. Reason: ${req.body.reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: 'User account and all associated data deleted successfully',
      data: {
        deleted_user: deletionData.user,
        deleted_content: deletionData.content_counts,
        deletion_reason: deletionData.reason,
        admin_action: {
          admin_id: req.user.userId,
          action: 'DELETE_USER',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;