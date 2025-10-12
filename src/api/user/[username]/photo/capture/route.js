const express = require('express');

const Photo = require('../../../../../models/Photo');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { calculatePhotoExpiry, calculateLivePhotoExpiry, canCreateLivePhoto } = require('../../../../../utils/RolePolicy');

const router = express.Router();

router.post('/:username/photo/capture', authenticateToken, checkBanStatus, async (req, res) => {
  const imageHandler = require('../../../../../utils/LocalImageHandler');

  const isLivePhoto = req.body.livePhoto === 'true' || req.body.livePhoto === true;
  const upload = isLivePhoto ? imageHandler.getLivePhotoUpload() : imageHandler.getPhotoUpload();

  const uploadFields = upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'video_files', maxCount: 5 }
  ]);

  uploadFields(req, res, async (err) => {
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
      const isLivePhoto = req.body.livePhoto === 'true' || req.body.livePhoto === true;

      console.log('📸 Received capture request:', {
        username,
        body: req.body,
        imageFiles: req.files?.images?.length || 0,
        videoFiles: req.files?.video_files?.length || 0,
        isLivePhoto,
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

      if (isLivePhoto) {
        if (!req.files?.images || req.files.images.length === 0) {
          errors.push({ msg: 'At least one image is required for live photo', path: 'images', location: 'files' });
        }
        if (!req.files?.video_files || req.files.video_files.length === 0) {
          errors.push({ msg: 'At least one video file is required for live photo', path: 'video_files', location: 'files' });
        }
      } else {
        if (!req.files?.images || req.files.images.length === 0) {
          errors.push({ msg: 'At least one photo is required', path: 'images', location: 'files' });
        }
      }

      if (errors.length > 0) {
        console.error('Validation errors:', errors);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
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

      if (isLivePhoto) {
        const livePhotoPermission = canCreateLivePhoto(targetUser.role);
        if (!livePhotoPermission.canCreate) {

          if (req.files?.images) {
            for (const file of req.files.images) {
              await imageHandler.deleteImage(file.path);
            }
          }
          if (req.files?.video_files) {
            for (const file of req.files.video_files) {
              await imageHandler.deleteVideo(file.path);
            }
          }

          return res.status(403).json({
            success: false,
            message: livePhotoPermission.reason || 'You do not have permission to create live photos',
            details: {
              current_role: targetUser.role
            }
          });
        }
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

      const images = req.files.images.map(file => imageHandler.getRelativeImagePath(file.path));

      let videoFiles = [];
      if (isLivePhoto && req.files.video_files) {
        videoFiles = req.files.video_files.map(file => imageHandler.getRelativeImagePath(file.path));
      }

      const expiryDate = isLivePhoto
        ? calculateLivePhotoExpiry(targetUser.role)
        : calculatePhotoExpiry(targetUser.role);

      console.log('💾 Creating photo with data:', {
        isLivePhoto,
        imagesCount: images.length,
        videoFilesCount: videoFiles.length,
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        frameId: frame_id,
        userId: targetUser._id,
        expiryDate,
        userRole: targetUser.role
      });

      const livePhotoPermission = canCreateLivePhoto(targetUser.role);
      const canSave = !isLivePhoto || livePhotoPermission.canSave;

      const baseUrl = req.protocol + '://' + req.get('host');

      if (isLivePhoto && !canSave) {
        console.log('📥 Live photo for basic user - returning download-only response');

        const downloadResponse = {
          images: images.map(img => baseUrl + '/' + img),
          video_files: videoFiles.map(vid => baseUrl + '/' + vid),
          title: title.trim(),
          desc: desc ? desc.trim() : '',
          livePhoto: true,
          download_only: true,
          frame: {
            id: frame._id,
            title: frame.title,
            layout_type: frame.layout_type,
            thumbnail: frame.thumbnail ? baseUrl + '/' + frame.thumbnail : null
          }
        };

        return res.status(200).json({
          success: true,
          message: 'Live photo created successfully. Download immediately (not saved to server)',
          data: {
            photo: downloadResponse
          },
          notice: 'Basic users must download live photos immediately. Upgrade to Verified to save for 3 days.'
        });
      }

      const photoData = {
        images,
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        frame_id,
        user_id: targetUser._id,
        expires_at: expiryDate,
        livePhoto: isLivePhoto
      };

      if (isLivePhoto && videoFiles.length > 0) {
        photoData.video_files = videoFiles;
      }

      const newPhoto = new Photo(photoData);

      await newPhoto.save();
      await newPhoto.populate([
        { path: 'frame_id', select: 'title layout_type thumbnail' },
        { path: 'user_id', select: 'name username role' }
      ]);

      console.log('✅ Photo saved successfully:', {
        photoId: newPhoto._id,
        expiresAt: newPhoto.expires_at
      });

      const photoResponse = {
        id: newPhoto._id,
        images: newPhoto.images.map(img => baseUrl + '/' + img),
        title: newPhoto.title,
        desc: newPhoto.desc,
        frame: {
          id: newPhoto.frame_id._id,
          title: newPhoto.frame_id.title,
          layout_type: newPhoto.frame_id.layout_type,
          thumbnail: newPhoto.frame_id.thumbnail ? baseUrl + '/' + newPhoto.frame_id.thumbnail : null
        },
        livePhoto: newPhoto.livePhoto,
        expires_at: newPhoto.expires_at,
        created_at: newPhoto.created_at,
        updated_at: newPhoto.updated_at
      };

      if (newPhoto.livePhoto && newPhoto.video_files && newPhoto.video_files.length > 0) {
        photoResponse.video_files = newPhoto.video_files.map(vid => baseUrl + '/' + vid);
      }

      res.status(201).json({
        success: true,
        message: isLivePhoto ? 'Live photo captured successfully' : 'Photo captured successfully',
        data: {
          photo: photoResponse
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