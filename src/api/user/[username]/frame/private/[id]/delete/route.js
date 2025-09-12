const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../../../../models/Frame');
const User = require('../../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../../middleware/middleware');
const imageHandler = require('../../../../../../../utils/LocalImageHandler');

const router = express.Router();

router.delete('/:username/frame/private/:id/delete', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid frame ID')
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
        message: 'Access denied. You can only delete your own frames.'
      });
    }

    const frame = await Frame.findOne({
      _id: req.params.id,
      user_id: targetUser._id
    });

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const frameData = {
      id: frame._id,
      title: frame.title,
      images: frame.images,
      thumbnail: frame.thumbnail
    };

    const allImagesToDelete = [];

    if (frame.images && Array.isArray(frame.images)) {
      allImagesToDelete.push(...frame.images);
    }

    if (frame.thumbnail) {
      allImagesToDelete.push(frame.thumbnail);
    }

    console.log(`🗑️ Deleting ${allImagesToDelete.length} images for frame ${frame._id}:`, allImagesToDelete);

    const imageDeletePromises = allImagesToDelete.map(async (imagePath) => {
      try {
        const result = await imageHandler.deleteImage(imagePath);
        if (result) {
          console.log(`✅ Successfully deleted: ${imagePath}`);
        } else {
          console.warn(`⚠️ Failed to delete: ${imagePath}`);
        }
      } catch (error) {
        console.error(`❌ Failed to delete image ${imagePath}:`, error);
      }
    });

    await Promise.allSettled(imageDeletePromises);

    await Frame.findByIdAndDelete(frame._id);

    res.json({
      success: true,
      message: 'Frame deleted successfully',
      data: {
        deleted_frame: {
          id: frameData.id,
          title: frameData.title,
          deleted_images_count: frameData.images.length,
          deleted_thumbnail: frameData.thumbnail ? 1 : 0,
          total_deleted_files: allImagesToDelete.length
        }
      }
    });

  } catch (error) {
    console.error('Delete frame error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;