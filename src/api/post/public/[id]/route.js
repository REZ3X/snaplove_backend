const express = require('express');
const { param, validationResult } = require('express-validator');
const PhotoPost = require('../../../../models/PhotoPost');

const router = express.Router();

router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid post ID')
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

    const post = await PhotoPost.findOne({ 
      _id: req.params.id, 
      posted: true 
    })
      .populate('user_id', 'name username image_profile role')
      .populate('template_frame_id', 'title layout_type official_status images');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      data: {
        post: {
          id: post._id,
          images: post.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: post.title,
          desc: post.desc,
          total_likes: post.total_likes,
          tag_label: post.tag_label,
          posted: post.posted,
          template_frame: post.template_frame_id ? {
            id: post.template_frame_id._id,
            title: post.template_frame_id.title,
            layout_type: post.template_frame_id.layout_type,
            official_status: post.template_frame_id.official_status,
            images: post.template_frame_id.images.map(img => req.protocol + '://' + req.get('host') + '/' + img)
          } : null,
          user: {
            id: post.user_id._id,
            name: post.user_id.name,
            username: post.user_id.username,
            image_profile: post.user_id.image_profile,
            role: post.user_id.role
          },
          created_at: post.created_at,
          updated_at: post.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get post by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;