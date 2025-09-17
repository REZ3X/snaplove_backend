const express = require('express');
const { param, body, validationResult } = require('express-validator');
const Photo = require('../../../../../models/Photo');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { calculatePhotoExpiry } = require('../../../../../utils/RolePolicy');

const router = express.Router();

router.post('/:username/photo/capture', authenticateToken, checkBanStatus, async (req, res) => {
  const imageHandler = require('../../../../../utils/LocalImageHandler');
  const upload = imageHandler.getPhotoUpload();

  upload.array('images', 5)(req, res, async (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    }

    try {
      const { frame_id, title, desc } = req.body;
      const { username } = req.params;

      console.log('📸 Received capture request:', {
        username,
        body: req.body,
        files: req.files?.length || 0,
        frame_id,
        title,
        desc
      });

      const errors = [];

      if (!username) {
        errors.push({ msg: 'Username is required', path: 'username', location: 'params' });
      }

      if (!frame_id) {
        errors.push({ msg: 'Frame ID is required', path: 'frame_id', location: 'body' });
      } else if (!/^[0-9a-fA-F]{24}$/.test(frame_id)) {
        errors.push({ msg: 'Frame ID must be a valid ObjectId', path: 'frame_id', location: 'body' });
      }

      if (!title) {
        errors.push({ msg: 'Title is required', path: 'title', location: 'body' });
      } else if (title.length < 1 || title.length > 100) {
        errors.push({ msg: 'Title must be 1-100 characters', path: 'title', location: 'body' });
      }

      if (desc && desc.length > 500) {
        errors.push({ msg: 'Description must be max 500 characters', path: 'desc', location: 'body' });
      }

      if (!req.files || req.files.length === 0) {
        errors.push({ msg: 'At least one photo is required', path: 'images', location: 'files' });
      }

      if (errors.length > 0) {
        console.error('Validation errors:', errors);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors
        });
      }

      const targetUser = await User.findOne({ username });
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

      console.log('🔍 Searching for frame:', {
        frame_id,
        targetUserId: targetUser._id
      });

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

      console.log('🖼️ Frame found:', {
        frameId: frame._id,
        title: frame.title,
        visibility: frame.visibility,
        ownerId: frame.user_id._id
      });

      if (frame.user_id._id.toString() !== targetUser._id.toString()) {
        frame.use_count.push({ user_id: targetUser._id });
        await frame.save();
      }

      const images = req.files.map(file => imageHandler.getRelativeImagePath(file.path));
      const expiryDate = calculatePhotoExpiry(targetUser.role);

      console.log('💾 Creating photo with data:', {
        imagesCount: images.length,
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        frameId: frame_id,
        userId: targetUser._id,
        expiryDate,
        userRole: targetUser.role
      });

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

      console.log('✅ Photo saved successfully:', {
        photoId: newPhoto._id,
        expiresAt: newPhoto.expires_at
      });

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
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

module.exports = router;