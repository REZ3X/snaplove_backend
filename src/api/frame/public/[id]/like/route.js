const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../../models/Frame');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware');

const router = express.Router();

router.post('/:id', [
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

    const frame = await Frame.findOne({ 
      _id: req.params.id, 
      visibility: 'public' 
    });

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const userId = req.user.userId;
    const existingLikeIndex = frame.like_count.findIndex(
      like => like.user_id.toString() === userId
    );

    let isLiked = false;
    let message = '';

    if (existingLikeIndex !== -1) {
      frame.like_count.splice(existingLikeIndex, 1);
      message = 'Frame unliked successfully';
    } else {
      frame.like_count.push({ user_id: userId });
      isLiked = true;
      message = 'Frame liked successfully';
    }

    await frame.save();

    res.json({
      success: true,
      message,
      data: {
        is_liked: isLiked,
        total_likes: frame.total_likes
      }
    });

  } catch (error) {
    console.error('Frame like error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;