const express = require('express');
const { param, validationResult } = require('express-validator');
const User = require('../../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../../middleware/middleware');
const imageHandler = require('../../../../../../../utils/LocalImageHandler');
const geminiAI = require('../../../../../../../utils/GeminiAIImage');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// idol upload
router.post('/:username/photo/capture/ai/idol', [
  param('username').notEmpty().withMessage('Username is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  const upload = imageHandler.getProfileUpload(); // Reuse profile upload config
  
  upload.single('idolImage')(req, res, async (err) => {
    if (err) {
      console.error('Idol image upload error:', err);
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
          message: 'Idol image is required',
          errors: [{ msg: 'No image file uploaded', path: 'idolImage', location: 'file' }]
        });
      }

      const targetUser = await User.findOne({ username: req.params.username });
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (req.user.userId !== targetUser._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only upload idol images for yourself.'
        });
      }

      const idolImagePath = imageHandler.getRelativeImagePath(req.file.path);
      const idolImageAbsPath = path.join(process.cwd(), idolImagePath);

      console.log('🎭 Validating idol image with Gemini AI:', idolImagePath);

      const validation = await geminiAI.validateImage(idolImageAbsPath);

      if (!validation.valid) {
        // Delete invalid image
        try {
          await fs.unlink(idolImageAbsPath);
        } catch (unlinkError) {
          console.error('Failed to delete invalid idol image:', unlinkError);
        }

        return res.status(400).json({
          success: false,
          message: 'Invalid idol image',
          validation: {
            valid: false,
            reason: validation.reason,
            details: validation.details || 'Image does not meet quality or content requirements'
          }
        });
      }

      console.log('✅ Idol image validated successfully');

      // Response
      res.status(200).json({
        success: true,
        message: 'Idol image uploaded and validated successfully',
        data: {
          idolImage: {
            path: idolImagePath,
            url: req.protocol + '://' + req.get('host') + '/' + idolImagePath,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploaded_at: new Date().toISOString()
          },
          validation: {
            valid: true,
            message: validation.message || 'Image validated successfully',
            ai_provider: 'Gemini AI'
          },
          user: {
            id: targetUser._id,
            username: targetUser.username
          },
          instructions: {
            usage: 'Use the "path" field in AI merge requests',
            cleanup: 'Call DELETE /photo/capture/ai/idol/cleanup to remove this image when done',
            note: 'This idol image will be merged with each captured photo in the photobooth'
          }
        }
      });

    } catch (error) {
      console.error('Idol image upload error:', error);
      
      // Try to cleanup uploaded file on error
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to cleanup file after error:', unlinkError);
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

router.delete('/:username/photo/capture/ai/idol/cleanup', [
  param('username').notEmpty().withMessage('Username is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const { idolImagePath } = req.body;
    
    if (!idolImagePath) {
      return res.status(400).json({
        success: false,
        message: 'Idol image path is required',
        errors: [{ msg: 'idolImagePath is required', path: 'idolImagePath', location: 'body' }]
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const idolImageAbsPath = path.join(process.cwd(), idolImagePath);

    // Delete file
    try {
      await fs.unlink(idolImageAbsPath);
      console.log('🗑️ Idol image cleaned up:', idolImagePath);
    } catch (error) {
      console.warn('Failed to delete idol image (might already be deleted):', error.message);
    }

    res.json({
      success: true,
      message: 'Idol image cleaned up successfully',
      data: {
        cleaned_path: idolImagePath,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Cleanup idol image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
