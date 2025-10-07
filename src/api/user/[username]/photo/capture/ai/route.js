const express = require('express');
const Photo = require('../../../../../../models/Photo');
const Frame = require('../../../../../../models/Frame');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware/middleware');
const { calculatePhotoExpiry } = require('../../../../../../utils/RolePolicy');
const imageHandler = require('../../../../../../utils/LocalImageHandler');
const geminiAI = require('../../../../../../utils/GeminiAIImage');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// preview ai image before merged
router.post('/:username/photo/capture/ai/preview', authenticateToken, checkBanStatus, async (req, res) => {
  const upload = imageHandler.getPhotoUpload();

  upload.single('capturedImage')(req, res, async (err) => {
    if (err) {
      console.error('AI preview upload error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    }

    try {
      const { idolImagePath, mergeStyle, creativityLevel, slotIndex } = req.body;
      const { username } = req.params;

      console.log('🎨 AI Preview Request:', {
        username,
        slotIndex: slotIndex || 0,
        idolImagePath,
        mergeStyle: mergeStyle || 'natural',
        creativityLevel: creativityLevel || 'medium'
      });

      const errors = [];
      if (!req.file) errors.push({ msg: 'Captured image is required', path: 'capturedImage', location: 'file' });
      if (!idolImagePath) errors.push({ msg: 'Idol image path is required', path: 'idolImagePath', location: 'body' });

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }

      const targetUser = await User.findOne({ username });
      if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

      if (req.user.userId !== targetUser._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const capturedImagePath = imageHandler.getRelativeImagePath(req.file.path);
      const capturedImageAbsPath = path.join(process.cwd(), capturedImagePath);
      const idolImageAbsPath = path.join(process.cwd(), idolImagePath);

      const [capturedValidation, idolValidation] = await Promise.all([
        geminiAI.validateImage(capturedImageAbsPath),
        geminiAI.validateImage(idolImageAbsPath)
      ]);

      if (!capturedValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid captured image',
          reason: capturedValidation.reason
        });
      }

      if (!idolValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid idol image',
          reason: idolValidation.reason
        });
      }

      // AI Merge
      console.log(`🤖 Starting AI merge for slot ${slotIndex || 0}...`);
      const mergedImageBase64 = await geminiAI.mergePhotos(
        capturedImageAbsPath,
        idolImageAbsPath,
        {
          style: mergeStyle || 'natural',
          creativityLevel: creativityLevel || 'medium',
          photoboothMode: true
        }
      );

      console.log('✅ AI merge preview completed successfully');

      res.json({
        success: true,
        message: 'AI merge preview generated successfully',
        data: {
          preview: {
            slotIndex: parseInt(slotIndex) || 0,
            mergedImageBase64,
            format: 'jpeg',
            capturedImagePath,
            idolImagePath,
            mergeOptions: {
              style: mergeStyle || 'natural',
              creativityLevel: creativityLevel || 'medium'
            },
            generated_at: new Date().toISOString()
          },
          instructions: {
            usage: 'Display this preview to user. When satisfied, call /submit endpoint with all captured images',
            note: 'This is a temporary preview. capturedImagePath will be used for final submission.'
          }
        }
      });

    } catch (error) {
      console.error('AI preview error:', error);
      res.status(500).json({
        success: false,
        message: 'AI merge preview failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });
});

//submit image merged image to frontend
router.post('/:username/photo/capture/ai/submit', authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const { 
      capturedImagePaths, 
      idolImagePath, 
      frame_id, 
      title, 
      desc, 
      mergeStyle, 
      creativityLevel 
    } = req.body;
    const { username } = req.params;

    console.log('📸 AI Photobooth Submit Request:', {
      username,
      frame_id,
      title,
      capturedImages: capturedImagePaths?.length || 0,
      idolImagePath,
      mergeStyle: mergeStyle || 'natural',
      creativityLevel: creativityLevel || 'medium'
    });

    const errors = [];
    if (!username) errors.push({ msg: 'Username is required', path: 'username', location: 'params' });
    if (!frame_id) errors.push({ msg: 'Frame ID is required', path: 'frame_id', location: 'body' });
    if (!title || title.length < 1 || title.length > 100) {
      errors.push({ msg: 'Title must be 1-100 characters', path: 'title', location: 'body' });
    }
    if (desc && desc.length > 500) {
      errors.push({ msg: 'Description must be max 500 characters', path: 'desc', location: 'body' });
    }
    if (!capturedImagePaths || !Array.isArray(capturedImagePaths) || capturedImagePaths.length === 0) {
      errors.push({ msg: 'At least one captured image path is required', path: 'capturedImagePaths', location: 'body' });
    }
    if (!idolImagePath) {
      errors.push({ msg: 'Idol image path is required', path: 'idolImagePath', location: 'body' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const targetUser = await User.findOne({ username });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const frame = await Frame.findOne({
      _id: frame_id,
      $or: [{ visibility: 'public' }, { user_id: targetUser._id }]
    }).populate('user_id', 'name username');

    if (!frame) return res.status(404).json({ success: false, message: 'Frame not found or not accessible' });

    const expectedSlots = frame.layout_type === '2x1' ? 2 
                        : frame.layout_type === '3x1' ? 3 
                        : frame.layout_type === '2x2' ? 4 
                        : capturedImagePaths.length;

    if (capturedImagePaths.length !== expectedSlots) {
      return res.status(400).json({
        success: false,
        message: `Frame layout ${frame.layout_type} requires ${expectedSlots} images, but ${capturedImagePaths.length} provided`
      });
    }

    // Update frame use count
    if (frame.user_id._id.toString() !== targetUser._id.toString()) {
      frame.use_count.push({ user_id: targetUser._id });
      await frame.save();
    }

    // Validate idol image
    const idolImageAbsPath = path.join(process.cwd(), idolImagePath);
    const idolValidation = await geminiAI.validateImage(idolImageAbsPath);
    
    if (!idolValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid idol image',
        reason: idolValidation.reason
      });
    }

    console.log(`🎨 Starting AI batch merge for ${capturedImagePaths.length} images...`);
    const capturedPhotoAbsPaths = capturedImagePaths.map(p => path.join(process.cwd(), p));

    const batchResults = await geminiAI.batchMergePhotos(
      capturedPhotoAbsPaths,
      idolImageAbsPath,
      {
        style: mergeStyle || 'natural',
        creativityLevel: creativityLevel || 'medium',
        frameLayout: frame.layout_type,
        photoboothMode: true
      }
    );

    const aiMergeResults = batchResults.map((result, index) => ({
      slotIndex: index,
      success: result.success,
      mergedImageBase64: result.success ? result.mergedImage : null,
      originalImagePath: capturedImagePaths[index],
      error: result.error || null
    }));

    const successCount = aiMergeResults.filter(r => r.success).length;
    console.log(`✅ AI batch merge completed: ${successCount}/${aiMergeResults.length} successful`);

    // Save photo to database
    const expiryDate = calculatePhotoExpiry(targetUser.role);
    const newPhoto = new Photo({
      images: capturedImagePaths, // Original captured images
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

    console.log('✅ AI Photobooth saved to database:', {
      photoId: newPhoto._id,
      expiresAt: newPhoto.expires_at,
      frameLayout: frame.layout_type,
      mergedSlots: successCount
    });

    res.status(201).json({
      success: true,
      message: 'AI Photobooth completed successfully',
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
            thumbnail: newPhoto.frame_id.thumbnail 
              ? req.protocol + '://' + req.get('host') + '/' + newPhoto.frame_id.thumbnail 
              : null
          },
          expires_at: newPhoto.expires_at,
          created_at: newPhoto.created_at,
          updated_at: newPhoto.updated_at
        },
        aiPhotobooth: {
          idolImage: idolImagePath,
          frameLayout: frame.layout_type,
          expectedSlots,
          processedSlots: aiMergeResults.length,
          results: aiMergeResults,
          statistics: {
            total: aiMergeResults.length,
            successful: successCount,
            failed: aiMergeResults.length - successCount,
            success_rate: `${((successCount / aiMergeResults.length) * 100).toFixed(1)}%`
          },
          options: {
            style: mergeStyle || 'natural',
            creativityLevel: creativityLevel || 'medium'
          }
        }
      }
    });

  } catch (error) {
    console.error('AI Photobooth submit error:', error);
    res.status(500).json({
      success: false,
      message: 'AI Photobooth submission failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
