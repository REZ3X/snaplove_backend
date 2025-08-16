const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../../../models/Frame');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../../../middleware');
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

    const imageDeletePromises = frame.images.map(async (imagePath) => {
      try {
        await imageHandler.deleteImage(imagePath);
        console.log(`Deleted image: ${imagePath}`);
      } catch (error) {
        console.error(`Failed to delete image ${imagePath}:`, error);
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