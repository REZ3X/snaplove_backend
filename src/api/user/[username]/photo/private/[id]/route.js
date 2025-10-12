const express = require('express');
const { param, validationResult } = require('express-validator');
const Photo = require('../../../../../../models/Photo');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware/middleware');

const router = express.Router();

router.get('/:username/photo/private/:id', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Valid photo ID is required')
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
        message: 'Access denied. You can only view your own photos.'
      });
    }

    const photo = await Photo.findOne({
      _id: req.params.id,
      user_id: targetUser._id
    }).populate('frame_id', 'title layout_type thumbnail');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    console.log('📸 Getting individual photo:', {
      photoId: photo._id,
      userId: targetUser._id,
      frameId: photo.frame_id?._id
    });

    const baseUrl = req.protocol + '://' + req.get('host');

    const formattedPhoto = {
      id: photo._id,
      images: photo.images.map(img => {
        if (img.startsWith('http')) {
          return img;
        }
        return baseUrl + '/' + img;
      }),
      title: photo.title,
      desc: photo.desc,
      livePhoto: photo.livePhoto || false,
      expires_at: photo.expires_at,
      created_at: photo.created_at,
      updated_at: photo.updated_at
    };

    if (photo.livePhoto && photo.video_files && photo.video_files.length > 0) {
      formattedPhoto.video_files = photo.video_files.map(vid => {
        if (vid.startsWith('http')) {
          return vid;
        }
        return baseUrl + '/' + vid;
      });
    }

    if (photo.frame_id) {
      formattedPhoto.frame = {
        id: photo.frame_id._id,
        title: photo.frame_id.title,
        layout_type: photo.frame_id.layout_type,
        thumbnail: photo.frame_id.thumbnail ?
          (photo.frame_id.thumbnail.startsWith('http') ?
            photo.frame_id.thumbnail :
            baseUrl + '/' + photo.frame_id.thumbnail
          ) : null
      };
    }

    res.json({
      success: true,
      data: {
        photo: formattedPhoto
      }
    });

  } catch (error) {
    console.error('Get photo by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;