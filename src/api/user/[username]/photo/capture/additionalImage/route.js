const express = require('express');
const { param, validationResult } = require('express-validator');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware/middleware');
const imageHandler = require('../../../../../../utils/LocalImageHandler');
const geminiAI = require('../../../../../../utils/GeminiAIImage');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

router.post('/:username/photo/capture/additionalImage', [
  param('username').notEmpty().withMessage('Username is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  const upload = imageHandler.getProfileUpload(); 
  upload.single('additionalImage')(req, res, async (err) => {
    if (err) {
      console.error('Additional image upload error:', err);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
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

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Additional image is required'
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
          message: 'Access denied. You can only upload additional images for yourself.'
        });
      }

      const validation = await geminiAI.validateImage(req.file.path);
      if (!validation.valid) {

        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup invalid file:', cleanupError);
        }

        return res.status(400).json({
          success: false,
          message: 'Invalid image file',
          details: validation
        });
      }

      const additionalImagePath = imageHandler.getRelativeImagePath(req.file.path);
      const imageUrl = req.protocol + '://' + req.get('host') + '/' + additionalImagePath;

      console.log(`✅ Additional image uploaded for user ${targetUser.username}: ${additionalImagePath}`);

      res.json({
        success: true,
        message: 'Additional image uploaded successfully',
        data: {
          additionalImage: {
            path: additionalImagePath,
            url: imageUrl,
            size: validation.size,
            width: validation.width,
            height: validation.height,
            format: validation.format,
            uploaded_at: new Date().toISOString()
          },
          user: {
            id: targetUser._id,
            username: targetUser.username
          }
        }
      });

    } catch (error) {
      console.error('Additional image upload error:', error);

      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup file after error:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

router.post('/:username/photo/capture/additionalImage/merge', [
  param('username').notEmpty().withMessage('Username is required')
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

    const { capturedPhotoPath, additionalImagePath, mergeOptions } = req.body;

    if (!capturedPhotoPath || !additionalImagePath) {
      return res.status(400).json({
        success: false,
        message: 'Both capturedPhotoPath and additionalImagePath are required'
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
        message: 'Access denied. You can only process merges for yourself.'
      });
    }

    const capturedPhotoAbsPath = path.join(process.cwd(), capturedPhotoPath);
    const additionalImageAbsPath = path.join(process.cwd(), additionalImagePath);

    const [capturedValidation, additionalValidation] = await Promise.all([
      geminiAI.validateImage(capturedPhotoAbsPath),
      geminiAI.validateImage(additionalImageAbsPath)
    ]);

    if (!capturedValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid captured photo',
        details: capturedValidation
      });
    }

    if (!additionalValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid additional image',
        details: additionalValidation
      });
    }

    console.log(`🤖 Starting AI merge for user ${targetUser.username}`);
    console.log(`   Captured: ${capturedPhotoPath}`);
    console.log(`   Additional: ${additionalImagePath}`);

    const mergedImageBase64 = await geminiAI.mergePhotos(
      capturedPhotoAbsPath,
      additionalImageAbsPath,
      mergeOptions || {}
    );

    console.log('✅ AI merge completed successfully');

    res.json({
      success: true,
      message: 'AI photo merge completed successfully',
      data: {
        mergedImage: {
          base64: mergedImageBase64,
          format: 'jpeg',
          processed_at: new Date().toISOString()
        },
        originalImages: {
          captured: capturedPhotoPath,
          additional: additionalImagePath
        },
        user: {
          id: targetUser._id,
          username: targetUser.username
        }
      }
    });

  } catch (error) {
    console.error('AI merge error:', error);
    res.status(500).json({
      success: false,
      message: 'AI merge failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

router.post('/:username/photo/capture/additionalImage/batchMerge', [
  param('username').notEmpty().withMessage('Username is required')
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

    const { capturedPhotoPaths, additionalImagePath, mergeOptions } = req.body;

    if (!capturedPhotoPaths || !Array.isArray(capturedPhotoPaths) || capturedPhotoPaths.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'capturedPhotoPaths must be a non-empty array'
      });
    }

    if (!additionalImagePath) {
      return res.status(400).json({
        success: false,
        message: 'additionalImagePath is required'
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
        message: 'Access denied. You can only process batch merges for yourself.'
      });
    }

    const capturedPhotoAbsPaths = capturedPhotoPaths.map(p => path.join(process.cwd(), p));
    const additionalImageAbsPath = path.join(process.cwd(), additionalImagePath);

    console.log(`🔄 Starting batch AI merge for user ${targetUser.username}`);
    console.log(`   Photos to process: ${capturedPhotoPaths.length}`);
    console.log(`   Additional image: ${additionalImagePath}`);

    const batchResults = await geminiAI.batchMergePhotos(
      capturedPhotoAbsPaths,
      additionalImageAbsPath,
      mergeOptions || {}
    );

    const successCount = batchResults.filter(r => r.success).length;
    const failureCount = batchResults.length - successCount;

    console.log(`✅ Batch AI merge completed: ${successCount} successful, ${failureCount} failed`);

    res.json({
      success: true,
      message: `Batch AI merge completed: ${successCount}/${batchResults.length} successful`,
      data: {
        results: batchResults.map(result => ({
          index: result.index,
          success: result.success,
          mergedImage: result.success ? {
            base64: result.mergedImage,
            format: 'jpeg'
          } : null,
          error: result.error || null,
          originalPath: result.originalPath
        })),
        statistics: {
          total: batchResults.length,
          successful: successCount,
          failed: failureCount,
          success_rate: `${((successCount / batchResults.length) * 100).toFixed(1)}%`
        },
        additionalImage: additionalImagePath,
        processed_at: new Date().toISOString(),
        user: {
          id: targetUser._id,
          username: targetUser.username
        }
      }
    });

  } catch (error) {
    console.error('Batch AI merge error:', error);
    res.status(500).json({
      success: false,
      message: 'Batch AI merge failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;