const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../../../models/Frame');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../../../middleware/middleware');
const imageHandler = require('../../../../../../utils/LocalImageHandler');

const router = express.Router();

router.delete('/:id/admin/delete', [
  param('id').isMongoId().withMessage('Invalid frame ID')
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

    const frame = await Frame.findOne({
      _id: req.params.id,
      visibility: 'public'
    }).populate('user_id', 'name username email role');

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
      thumbnail: frame.thumbnail,
      owner: {
        id: frame.user_id._id,
        name: frame.user_id.name,
        username: frame.user_id.username,
        email: frame.user_id.email,
        role: frame.user_id.role
      },
      total_likes: frame.total_likes,
      total_uses: frame.total_uses,
      created_at: frame.created_at
    };

    console.log(`ADMIN DELETE: Admin ${req.user.userId} deleted frame ${frame._id} by user ${frame.user_id.username}`);

    const allImagesToDelete = [];
 
    if (frame.images && Array.isArray(frame.images)) {
      allImagesToDelete.push(...frame.images);
    }

    if (frame.thumbnail) {
      allImagesToDelete.push(frame.thumbnail);
    }

    console.log(`🗑️ Admin deleting ${allImagesToDelete.length} images for frame ${frame._id}:`, allImagesToDelete);

    const imageDeletePromises = allImagesToDelete.map(async (imagePath) => {
      try {
        const result = await imageHandler.deleteImage(imagePath);
        if (result) {
          console.log(`✅ Admin successfully deleted: ${imagePath}`);
        } else {
          console.warn(`⚠️ Admin failed to delete: ${imagePath}`);
        }
      } catch (error) {
        console.error(`❌ Admin failed to delete image ${imagePath}:`, error);
      }
    });

    await Promise.allSettled(imageDeletePromises);

    await Frame.findByIdAndDelete(frame._id);

    res.json({
      success: true,
      message: 'Frame deleted successfully by admin',
      data: {
        deleted_frame: {
          id: frameData.id,
          title: frameData.title,
          owner: frameData.owner,
          deleted_images_count: frameData.images.length,
          deleted_thumbnail: frameData.thumbnail ? 1 : 0,
          total_deleted_files: allImagesToDelete.length,
          total_likes: frameData.total_likes,
          total_uses: frameData.total_uses,
          created_at: frameData.created_at
        },
        admin_action: {
          admin_id: req.user.userId,
          action: 'DELETE_FRAME',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Admin delete frame error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;