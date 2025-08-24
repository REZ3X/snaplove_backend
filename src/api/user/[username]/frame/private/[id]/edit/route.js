const express = require('express');
const { param, body, validationResult } = require('express-validator');
const Frame = require('../../../../../../../models/Frame');
const User = require('../../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../../middleware/middleware');
const { canCreatePublicFrame } = require('../../../../../../../utils/RolePolicy');

const router = express.Router();

router.put('/:username/frame/private/:id/edit', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid frame ID'),
  body('title').optional().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('desc').optional().isLength({ max: 500 }).withMessage('Description must be max 500 characters'),
  body('layout_type').optional().isIn(['2x1', '3x1', '4x1']).withMessage('Invalid layout type'),
  body('visibility').optional().isIn(['private', 'public']).withMessage('Invalid visibility'),
  body('tag_label').optional().isArray().withMessage('Tag labels must be an array')
], authenticateToken, checkBanStatus, async (req, res) => {
  const imageHandler = require('../../../../../../../utils/LocalImageHandler');
  const upload = imageHandler.getFrameUpload();

  upload.single('thumbnail')(req, res, async (err) => {
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
          message: 'Access denied. You can only edit your own frames.'
        });
      }

      const frame = await Frame.findOne({
        _id: req.params.id,
        user_id: targetUser._id
      });

      if (!frame) {
        return res.status(404).json({
          success: false,
          message: 'Frame not found'
        });
      }

      const { title, desc, layout_type, visibility, tag_label } = req.body;


      if (visibility === 'public' && frame.visibility === 'private') {

        const newThumbnail = req.file ? imageHandler.getRelativeImagePath(req.file.path) : null;

        if (!newThumbnail && !frame.thumbnail) {
          return res.status(400).json({
            success: false,
            message: 'Thumbnail is required when making frame public'
          });
        }


        const canCreate = await canCreatePublicFrame(req.user.userId);
        if (!canCreate.canCreate) {
          return res.status(403).json({
            success: false,
            message: canCreate.reason,
            data: {
              current_count: canCreate.current,
              limit: canCreate.limit
            }
          });
        }


        if (newThumbnail) {
          frame.thumbnail = newThumbnail;
        }
      }


      if (title !== undefined) frame.title = title.trim();
      if (desc !== undefined) frame.desc = desc.trim();
      if (layout_type !== undefined) frame.layout_type = layout_type;
      if (visibility !== undefined) frame.visibility = visibility;
      if (tag_label !== undefined) frame.tag_label = tag_label;


      if (req.file) {

        if (frame.thumbnail) {
          try {
            await imageHandler.deleteImage(frame.thumbnail);
          } catch (error) {
            console.error('Failed to delete old thumbnail:', error);
          }
        }
        frame.thumbnail = imageHandler.getRelativeImagePath(req.file.path);
      }

      await frame.save();
      await frame.populate('user_id', 'name username image_profile role');

      console.log(`FRAME UPDATED: User ${targetUser.username} updated frame ${frame._id} to ${frame.visibility}`);

      res.json({
        success: true,
        message: 'Frame updated successfully',
        data: {
          frame: {
            id: frame._id,
            images: frame.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
            title: frame.title,
            desc: frame.desc,
            total_likes: frame.total_likes,
            total_uses: frame.total_uses,
            layout_type: frame.layout_type,
            official_status: frame.official_status,
            visibility: frame.visibility,
            tag_label: frame.tag_label,
            user: {
              id: frame.user_id._id,
              name: frame.user_id.name,
              username: frame.user_id.username,
              image_profile: frame.user_id.image_profile,
              role: frame.user_id.role
            },
            created_at: frame.created_at,
            updated_at: frame.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Edit frame error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
});

module.exports = router;