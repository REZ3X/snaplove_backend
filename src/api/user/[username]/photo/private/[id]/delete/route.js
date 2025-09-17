const express = require('express');
const { param, validationResult } = require('express-validator');
const Photo = require('../../../../../../../models/Photo');
const User = require('../../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../../middleware/middleware');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

router.delete('/:username/photo/private/:id/delete', [
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
        message: 'Access denied. You can only delete your own photos.'
      });
    }

    const photo = await Photo.findOne({
      _id: req.params.id,
      user_id: targetUser._id
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    console.log('🗑️ Deleting photo:', {
      photoId: photo._id,
      userId: targetUser._id,
      imagesCount: photo.images.length,
      imagePaths: photo.images
    });

    const imageHandler = require('../../../../../../../utils/LocalImageHandler');
    const deletedFiles = [];
    const failedFiles = [];
    
    for (const imagePath of photo.images) {
      try {
        console.log('🗑️ Attempting to delete image:', imagePath);
        
        const possiblePaths = [
          imageHandler.getFullImagePath ? imageHandler.getFullImagePath(imagePath) : null,
          path.join(process.cwd(), imagePath),
          path.join(process.cwd(), 'uploads', imagePath),
          path.join(process.cwd(), 'public', imagePath),
          path.isAbsolute(imagePath) ? imagePath : null
        ].filter(Boolean);

        let deleted = false;
        for (const fullPath of possiblePaths) {
          try {
            console.log('🔍 Checking path:', fullPath);
            await fs.access(fullPath);
            await fs.unlink(fullPath);
            console.log('✅ Successfully deleted:', fullPath);
            deletedFiles.push(fullPath);
            deleted = true;
            break;
          } catch (pathError) {
            console.log('❌ Path not found or error:', fullPath, pathError.message);
            continue;
          }
        }

        if (!deleted) {
          console.warn('⚠️ Could not find file to delete:', imagePath);
          failedFiles.push(imagePath);
        }

      } catch (error) {
        console.error('❌ Error processing image deletion:', imagePath, error);
        failedFiles.push(imagePath);
      }
    }

    await Photo.findByIdAndDelete(photo._id);

    console.log('✅ Photo deleted from database:', photo._id);
    console.log('📊 File deletion summary:', {
      totalFiles: photo.images.length,
      deletedFiles: deletedFiles.length,
      failedFiles: failedFiles.length,
      failedPaths: failedFiles
    });

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      data: {
        deleted_photo_id: photo._id,
        file_deletion_summary: {
          total_files: photo.images.length,
          deleted_files: deletedFiles.length,
          failed_files: failedFiles.length,
          failed_paths: failedFiles
        }
      }
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;