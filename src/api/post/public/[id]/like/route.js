const express = require('express');
const { param, validationResult } = require('express-validator');
const PhotoPost = require('../../../../../models/PhotoPost');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware');

const router = express.Router();

router.post('/:id', [
  param('id').isMongoId().withMessage('Invalid post ID')
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

    const post = await PhotoPost.findOne({ 
      _id: req.params.id, 
      posted: true 
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const userId = req.user.userId;
    const existingLikeIndex = post.like_count.findIndex(
      like => like.user_id.toString() === userId
    );

    let isLiked = false;
    let message = '';

    if (existingLikeIndex !== -1) {
      post.like_count.splice(existingLikeIndex, 1);
      message = 'Post unliked successfully';
    } else {
      post.like_count.push({ user_id: userId });
      isLiked = true;
      message = 'Post liked successfully';
    }

    await post.save();

    res.json({
      success: true,
      message,
      data: {
        is_liked: isLiked,
        total_likes: post.total_likes
      }
    });

  } catch (error) {
    console.error('Post like error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;