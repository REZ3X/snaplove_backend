const express = require('express');
const Photo = require('../../../../../models/Photo');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { calculatePhotoExpiry } = require('../../../../../utils/RolePolicy');
const path = require('path'); 
const geminiAI = require('../../../../../utils/GeminiAIImage');

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
      const { frame_id, title, desc, additionalImagePath, enableAIMerge, mergeStyle, creativityLevel } = req.body;
      const { username } = req.params;

      console.log('📸 AI Photobooth Capture Request:', {
        username,
        frame_id,
        title,
        capturedImages: req.files?.length || 0,
        enableAIMerge,
        additionalImagePath,
        mergeStyle: mergeStyle || 'natural',
        creativityLevel: creativityLevel || 'medium'
      });

      const errors = [];
      if (!username) errors.push({ msg: 'Username is required', path: 'username', location: 'params' });
      if (!frame_id) errors.push({ msg: 'Frame ID is required', path: 'frame_id', location: 'body' });
      if (!title || title.length < 1 || title.length > 100) errors.push({ msg: 'Title must be 1-100 characters', path: 'title', location: 'body' });
      if (desc && desc.length > 500) errors.push({ msg: 'Description must be max 500 characters', path: 'desc', location: 'body' });
      if (!req.files || req.files.length === 0) errors.push({ msg: 'At least one photo is required', path: 'images', location: 'files' });

      if (enableAIMerge === 'true' && !additionalImagePath) {
        errors.push({ msg: 'Additional image path is required for AI Photobooth', path: 'additionalImagePath', location: 'body' });
      }

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }

      const targetUser = await User.findOne({ username });
      if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

      if (req.user.userId !== targetUser._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only capture photos for yourself.' });
      }

      const frame = await Frame.findOne({
        _id: frame_id,
        $or: [{ visibility: 'public' }, { user_id: targetUser._id }]
      }).populate('user_id', 'name username');

      if (!frame) return res.status(404).json({ success: false, message: 'Frame not found or not accessible' });

      if (frame.user_id._id.toString() !== targetUser._id.toString()) {
        frame.use_count.push({ user_id: targetUser._id });
        await frame.save();
      }

      const images = req.files.map(file => imageHandler.getRelativeImagePath(file.path));
      const expiryDate = calculatePhotoExpiry(targetUser.role);

      console.log('🤖 AI Photobooth Processing:', {
        frameLayout: frame.layout_type,
        capturedImages: images.length,
        expectedMerges: frame.layout_type === '2x1' ? 2 : (frame.layout_type === '3x1' ? 3 : 4)
      });

      let aiMergeResults = [];
      const finalImages = images; 
      if (enableAIMerge === 'true' && additionalImagePath) {
        try {
          const additionalImageAbsPath = path.join(process.cwd(), additionalImagePath);

          const additionalValidation = await geminiAI.validateImage(additionalImageAbsPath);
          if (!additionalValidation.valid) {
            console.warn('⚠️ Invalid additional image, proceeding without AI merge');
          } else {
            console.log('🎨 Starting AI Photobooth merge process...');

            const capturedPhotoAbsPaths = images.map(imgPath => path.join(process.cwd(), imgPath));

            const batchResults = await geminiAI.batchMergePhotos(
              capturedPhotoAbsPaths,
              additionalImageAbsPath,
              {
                style: mergeStyle || 'natural',
                creativityLevel: creativityLevel || 'medium',
                frameLayout: frame.layout_type,
                photoboothMode: true
              }
            );

            aiMergeResults = batchResults.map((result, index) => ({
              index,
              success: result.success,
              mergedImageBase64: result.success ? result.mergedImage : null,
              originalImage: images[index],
              error: result.error || null
            }));


            console.log(`✅ AI Photobooth completed: ${aiMergeResults.filter(r => r.success).length}/${aiMergeResults.length} successful merges`);
          }
        } catch (aiError) {
          console.error('❌ AI Photobooth failed, proceeding with original images:', aiError);
          aiMergeResults = images.map((img, index) => ({
            index,
            success: false,
            mergedImageBase64: null,
            originalImage: img,
            error: aiError.message
          }));
        }
      }

      const newPhoto = new Photo({
        images: finalImages,
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

      console.log('✅ AI Photobooth capture completed:', {
        photoId: newPhoto._id,
        expiresAt: newPhoto.expires_at,
        aiMergesSuccessful: aiMergeResults.filter(r => r.success).length,
        frameLayout: frame.layout_type
      });

      const response = {
        success: true,
        message: enableAIMerge === 'true' ? 'AI Photobooth capture completed successfully' : 'Photo captured successfully',
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
      };

      if (enableAIMerge === 'true') {
        response.data.aiPhotobooth = {
          enabled: true,
          additionalImage: additionalImagePath,
          frameLayout: frame.layout_type,
          expectedSlots: frame.layout_type === '2x1' ? 2 : (frame.layout_type === '3x1' ? 3 : 4),
          processedSlots: aiMergeResults.length,
          results: aiMergeResults,
          statistics: {
            total: aiMergeResults.length,
            successful: aiMergeResults.filter(r => r.success).length,
            failed: aiMergeResults.filter(r => !r.success).length,
            success_rate: `${((aiMergeResults.filter(r => r.success).length / aiMergeResults.length) * 100).toFixed(1)}%`
          },
          options: {
            style: mergeStyle || 'natural',
            creativityLevel: creativityLevel || 'medium'
          },
          preview: {
            instructions: 'Use the mergedImageBase64 from results array for frontend preview. Original images will be used for final frame assembly.',
            format: 'base64',
            usage: 'Display merged images in preview, then use original images for frame creation'
          }
        };
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('AI Photobooth capture error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

module.exports = router;