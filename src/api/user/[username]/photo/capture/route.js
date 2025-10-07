const express = require('express');
const Photo = require('../../../../../models/Photo');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { calculatePhotoExpiry } = require('../../../../../utils/RolePolicy');

// Normal capture without AI
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

      console.log('📸 Regular Photo Capture Request:', {
        username,
        frame_id,
        title,
        capturedImages: req.files?.length || 0
      });

      // Validation
      const errors = [];
      if (!username) errors.push({ msg: 'Username is required', path: 'username', location: 'params' });
      if (!frame_id) errors.push({ msg: 'Frame ID is required', path: 'frame_id', location: 'body' });
      if (!title || title.length < 1 || title.length > 100) errors.push({ msg: 'Title must be 1-100 characters', path: 'title', location: 'body' });
      if (desc && desc.length > 500) errors.push({ msg: 'Description must be max 500 characters', path: 'desc', location: 'body' });
      if (!req.files || req.files.length === 0) errors.push({ msg: 'At least one photo is required', path: 'images', location: 'files' });

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }

      // Find user
      const targetUser = await User.findOne({ username });
      if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

      if (req.user.userId !== targetUser._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only capture photos for yourself.' });
      }

      // Find frame
      const frame = await Frame.findOne({
        _id: frame_id,
        $or: [{ visibility: 'public' }, { user_id: targetUser._id }]
      }).populate('user_id', 'name username');

      if (!frame) return res.status(404).json({ success: false, message: 'Frame not found or not accessible' });

      // Update frame use count
      if (frame.user_id._id.toString() !== targetUser._id.toString()) {
        frame.use_count.push({ user_id: targetUser._id });
        await frame.save();
      }

      // Process images
      const images = req.files.map(file => imageHandler.getRelativeImagePath(file.path));
      const expiryDate = calculatePhotoExpiry(targetUser.role);

      // Save photo to database
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

      console.log('✅ Regular photo capture completed:', {
        photoId: newPhoto._id,
        expiresAt: newPhoto.expires_at
      });

      // Response
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
      console.error('Regular photo capture error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

module.exports = router;