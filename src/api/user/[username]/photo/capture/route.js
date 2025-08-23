const express = require('express');
const { param, body, validationResult } = require('express-validator');
const Photo = require('../../../../../models/Photo');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware');
const { calculatePhotoExpiry } = require('../../../../../utils/RolePolicy');

const router = express.Router();

router.post('/:username/photo/capture', [
  param('username').notEmpty().withMessage('Username is required'),
  body('frame_id').isMongoId().withMessage('Valid frame ID is required'),
  body('title').notEmpty().isLength({ min: 1, max: 100 }).withMessage('Title is required and must be 1-100 characters'),
  body('desc').optional().isLength({ max: 500 }).withMessage('Description must be max 500 characters')
], authenticateToken, checkBanStatus, async (req, res) => {
  const imageHandler = require('../../../../../../utils/LocalImageHandler');
  const upload = imageHandler.getPhotoUpload();

  upload.array('images', 5)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

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
          message: 'Access denied. You can only capture photos for yourself.'
        });
      }

      const { frame_id, title, desc } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one photo is required'
        });
      }


      const frame = await Frame.findOne({
        _id: frame_id,
        $or: [
          { visibility: 'public' },
          { user_id: targetUser._id }
        ]
      }).populate('user_id', 'name username');

      if (!frame) {
        return res.status(404).json({
          success: false,
          message: 'Frame not found or not accessible'
        });
      }


      if (frame.user_id._id.toString() !== targetUser._id.toString()) {
        frame.use_count.push({ user_id: targetUser._id });
        await frame.save();
      }

      const images = req.files.map(file => imageHandler.getRelativeImagePath(file.path));
      const expiryDate = calculatePhotoExpiry(targetUser.role);

      const newPhoto = new Photo({
        images,
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        frame_id,
        user_id: targetUser._id,
        expires_at: expiryDate
      });

      await newPhoto.save();
      await newPhoto.populate([
        { path: 'frame_id', select: 'title layout_type thumbnail' },
        { path: 'user_id', select: 'name username role' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Photo captured successfully',
        data: {
          photo: {
            id: newPhoto._id,
            images: newPhoto.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            title: newPhoto.title,
            desc: newPhoto.desc,
            frame: {
              id: newPhoto.frame_id._id,
              title: newPhoto.frame_id.title,
              layout_type: newPhoto.frame_id.layout_type,
              thumbnail: newPhoto.frame_id.thumbnail ? req.protocol + '://' + req.get('host') + '/' + newPhoto.frame_id.thumbnail : null
            },
            expires_at: newPhoto.expires_at,
            created_at: newPhoto.created_at,
            updated_at: newPhoto.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Capture photo error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
});

module.exports = router;