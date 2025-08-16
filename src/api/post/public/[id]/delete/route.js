const express = require('express');
const { param, validationResult } = require('express-validator');
const PhotoPost = require('../../../../../models/PhotoPost');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../../middleware');
const imageHandler = require('../../../../../utils/LocalImageHandler');

const router = express.Router();

router.delete('/:id/delete', [
  param('id').isMongoId().withMessage('Invalid post ID')
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

    const post = await PhotoPost.findOne({ 
      _id: req.params.id, 
      posted: true 
    }).populate('user_id', 'name username email role')
      .populate('template_frame_id', 'title layout_type official_status');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const postData = {
      id: post._id,
      title: post.title,
      images: post.images,
      owner: {
        id: post.user_id._id,
        name: post.user_id.name,
        username: post.user_id.username,
        email: post.user_id.email,
        role: post.user_id.role
      },
      total_likes: post.total_likes,
      template_frame: post.template_frame_id ? {
        id: post.template_frame_id._id,
        title: post.template_frame_id.title,
        layout_type: post.template_frame_id.layout_type,
        official_status: post.template_frame_id.official_status
      } : null,
      created_at: post.created_at
    };

    console.log(`ADMIN DELETE: Admin ${req.user.userId} deleted post ${post._id} by user ${post.user_id.username}`);

    const imageDeletePromises = post.images.map(async (imagePath) => {
      try {
        await imageHandler.deleteImage(imagePath);
        console.log(`Deleted image: ${imagePath}`);
      } catch (error) {
        console.error(`Failed to delete image ${imagePath}:`, error);
      }
    });

    await Promise.allSettled(imageDeletePromises);

    await PhotoPost.findByIdAndDelete(post._id);

    res.json({
      success: true,
      message: 'Post deleted successfully by admin',
      data: {
        deleted_post: {
          id: postData.id,
          title: postData.title,
          owner: postData.owner,
          deleted_images_count: postData.images.length,
          total_likes: postData.total_likes,
          template_frame: postData.template_frame,
          created_at: postData.created_at
        },
        admin_action: {
          admin_id: req.user.userId,
          action: 'DELETE_POST',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;