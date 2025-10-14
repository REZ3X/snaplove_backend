const express = require('express');

const Photo = require('../../../../../models/Photo');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const AIPhotoBoothUsage = require('../../../../../models/AIPhotoBoothUsage');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { calculatePhotoExpiry, calculateLivePhotoExpiry, canCreateLivePhoto } = require('../../../../../utils/RolePolicy');

const router = express.Router();

function getAIPhotoboothLimit(role) {
  const limits = {
    basic: 3,
    verified_basic: 10,
    verified_premium: 10,
    official: -1,
    developer: -1,
  };
  return limits[role?.toLowerCase()] || 3;
}

function isAIUnlimited(role) {
  return ['official', 'developer'].includes(role?.toLowerCase());
}

async function getAIUsage(userId, username) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let usage = await AIPhotoBoothUsage.findOne({
    user_id: userId,
    month: currentMonth,
    year: currentYear
  });

  if (!usage) {
    usage = new AIPhotoBoothUsage({
      user_id: userId,
      username,
      count: 0,
      month: currentMonth,
      year: currentYear,
      last_used_at: null
    });
    await usage.save();
  }

  return usage;
}

async function incrementAIUsage(userId, username) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const usage = await AIPhotoBoothUsage.findOneAndUpdate(
    {
      user_id: userId,
      month: currentMonth,
      year: currentYear
    },
    {
      $inc: { count: 1 },
      $set: {
        last_used_at: now,
        username
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return usage;
}

async function checkAILimit(userId, username, userRole) {
  if (isAIUnlimited(userRole)) {
    return {
      canUse: true,
      remaining: -1,
      limit: -1,
      isUnlimited: true,
      used: 0
    };
  }

  const usage = await getAIUsage(userId, username);
  const limit = getAIPhotoboothLimit(userRole);
  const remaining = Math.max(0, limit - usage.count);

  return {
    canUse: remaining > 0,
    remaining,
    limit,
    isUnlimited: false,
    used: usage.count
  };
}

router.get('/:username/photo/capture/ai/usage', authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (req.user.userId !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this data'
      });
    }

    if (isAIUnlimited(user.role)) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return res.status(200).json({
        success: true,
        data: {
          count: 0,
          limit: -1,
          remaining: -1,
          isUnlimited: true,
          month: now.getMonth(),
          year: now.getFullYear(),
          resetDate: nextMonth.toISOString(),
          lastUsedAt: null
        }
      });
    }

    const usage = await getAIUsage(user._id, username);
    const limit = getAIPhotoboothLimit(user.role);
    const remaining = Math.max(0, limit - usage.count);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return res.status(200).json({
      success: true,
      data: {
        count: usage.count,
        limit,
        remaining,
        isUnlimited: false,
        month: usage.month,
        year: usage.year,
        resetDate: nextMonth.toISOString(),
        lastUsedAt: usage.last_used_at
      }
    });

  } catch (error) {
    console.error('Error getting AI usage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get AI usage data'
    });
  }
});

router.post('/:username/photo/capture/ai/usage', authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (req.user.userId !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to increment usage'
      });
    }

    if (isAIUnlimited(user.role)) {
      return res.status(200).json({
        success: true,
        message: 'Unlimited access - no tracking needed',
        data: {
          count: 0,
          limit: -1,
          remaining: -1,
          isUnlimited: true
        }
      });
    }

    const usage = await incrementAIUsage(user._id, username);
    const limit = getAIPhotoboothLimit(user.role);
    const remaining = Math.max(0, limit - usage.count);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return res.status(200).json({
      success: true,
      message: 'AI usage incremented',
      data: {
        count: usage.count,
        limit,
        remaining,
        isUnlimited: false,
        month: usage.month,
        year: usage.year,
        resetDate: nextMonth.toISOString(),
        lastUsedAt: usage.last_used_at
      }
    });

  } catch (error) {
    console.error('Error incrementing AI usage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to increment AI usage'
    });
  }
});

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
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    }

    try {
      const { frame_id, title, desc } = req.body;
      const { username } = req.params;
      const isLivePhoto = req.body.livePhoto === 'true' || req.body.livePhoto === true;
      const isAIPhoto = req.body.aiPhoto === 'true' || req.body.aiPhoto === true;

      const errors = [];

      if (!username) {
        errors.push('Username is required');
      }

      if (!frame_id) {
        errors.push('Frame ID is required');
      } else if (!/^[0-9a-fA-F]{24}$/.test(frame_id)) {
        errors.push('Invalid Frame ID format');
      }

      if (!title) {
        errors.push('Title is required');
      } else if (title.length < 1 || title.length > 100) {
        errors.push('Title must be 1-100 characters');
      }

      if (desc && desc.length > 500) {
        errors.push('Description must be 500 characters or less');
      }

      if (isLivePhoto) {
        if (!req.files?.images || req.files.images.length === 0) {
          errors.push('At least one image is required for live photo');
        }
        if (!req.files?.video_files || req.files.video_files.length === 0) {
          errors.push('At least one video file is required for live photo');
        }
      } else {
        if (!req.files?.images || req.files.images.length === 0) {
          errors.push('At least one image is required');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
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
          message: 'Not authorized to create photo for this user'
        });
      }

      if (isAIPhoto) {
        const aiLimit = await checkAILimit(targetUser._id, username, targetUser.role);

        if (!aiLimit.canUse) {
          return res.status(403).json({
            success: false,
            message: 'AI Photobooth monthly limit reached',
            ai_limit: {
              used: aiLimit.used,
              limit: aiLimit.limit,
              remaining: aiLimit.remaining,
              isUnlimited: aiLimit.isUnlimited
            }
          });
        }
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
        if (frame.visibility !== 'public') {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to use this frame'
          });
        }

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

      const livePhotoPermission = canCreateLivePhoto(targetUser.role);
      const canSave = !isLivePhoto || livePhotoPermission.canSave;

      const baseUrl = req.protocol + '://' + req.get('host');

      if (isLivePhoto && !canSave) {
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
        livePhoto: isLivePhoto,
        aiPhoto: isAIPhoto
      };

      if (isLivePhoto && videoFiles.length > 0) {
        photoData.video_files = videoFiles;
      }

      const newPhoto = new Photo(photoData);
      await newPhoto.save();

      if (isAIPhoto) {
        await incrementAIUsage(targetUser._id, username);
      }

      await newPhoto.populate([
        { path: 'frame_id', select: 'title layout_type thumbnail' },
        { path: 'user_id', select: 'name username role' }
      ]);

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
        aiPhoto: newPhoto.aiPhoto,
        expires_at: newPhoto.expires_at,
        created_at: newPhoto.created_at,
        updated_at: newPhoto.updated_at
      };

      if (newPhoto.livePhoto && newPhoto.video_files && newPhoto.video_files.length > 0) {
        photoResponse.video_files = newPhoto.video_files.map(vid => baseUrl + '/' + vid);
      }

      if (isAIPhoto) {
        const updatedLimit = await checkAILimit(targetUser._id, username, targetUser.role);
        photoResponse.ai_usage = {
          used: updatedLimit.used,
          limit: updatedLimit.limit,
          remaining: updatedLimit.remaining,
          isUnlimited: updatedLimit.isUnlimited
        };
      }

      res.status(201).json({
        success: true,
        message: 'Photo captured successfully',
        data: {
          photo: photoResponse
        }
      });

    } catch (error) {
      console.error('Error capturing photo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to capture photo'
      });
    }
  });
});

module.exports = router;