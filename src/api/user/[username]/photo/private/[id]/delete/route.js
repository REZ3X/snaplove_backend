const express = require('express');
const { param, validationResult } = require('express-validator');
const Photo = require('../../../../../../../models/Photo');
const User = require('../../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../../middleware/middleware');
const imageHandler = require('../../../../../../../utils/LocalImageHandler');

const router = express.Router();

router.delete('/:username/photo/private/:id/delete', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid photo ID')
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
        message: 'Access denied. You can only delete your own photos.'
      });
    }

    const photo = await Photo.findOne({
      _id: req.params.id,
      user_id: targetUser._id
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    const photoData = {
      id: photo._id,
      title: photo.title,
      images: photo.images
    };

    const imageDeletePromises = photo.images.map(async (imagePath) => {
      try {
        await imageHandler.deleteImage(imagePath);
      } catch (error) {
        console.error(`Failed to delete image ${imagePath}:`, error);
      }
    });

    await Promise.allSettled(imageDeletePromises);

    await Photo.findByIdAndDelete(photo._id);

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      data: {
        deleted_photo: {
          id: photoData.id,
          title: photoData.title,
          deleted_images_count: photoData.images.length
        }
      }
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;