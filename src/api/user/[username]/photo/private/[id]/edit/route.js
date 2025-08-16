const express = require('express');
const { param, body, validationResult } = require('express-validator');
const PhotoPost = require('../../../../../../../models/PhotoPost');
const User = require('../../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../../middleware');

const router = express.Router();

router.put('/:username/photo/private/:id/edit', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid photo ID'),
  body('title').optional().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('desc').optional().isLength({ max: 500 }).withMessage('Description must be max 500 characters'),
  body('posted').optional().isBoolean().withMessage('Posted must be boolean'),
  body('template_frame_id').optional().isMongoId().withMessage('Invalid frame template ID'),
  body('tag_label').optional().isArray().withMessage('Tag labels must be an array')
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
        message: 'Access denied. You can only edit your own photos.'
      });
    }

    const photo = await PhotoPost.findOne({ 
      _id: req.params.id,
      user_id: targetUser._id
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    const { title, desc, posted, template_frame_id, tag_label } = req.body;

    if (template_frame_id) {
      const Frame = require('../../../../../../../models/Frame');
      const frameTemplate = await Frame.findById(template_frame_id);
      if (!frameTemplate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template frame ID'
        });
      }
    }

    if (title !== undefined) photo.title = title.trim();
    if (desc !== undefined) photo.desc = desc.trim();
    if (posted !== undefined) photo.posted = posted;
    if (template_frame_id !== undefined) photo.template_frame_id = template_frame_id || null;
    if (tag_label !== undefined) photo.tag_label = tag_label;

    await photo.save();
    await photo.populate([
      { path: 'user_id', select: 'name username image_profile role' },
      { path: 'template_frame_id', select: 'title layout_type official_status' }
    ]);

    res.json({
      success: true,
      message: 'Photo updated successfully',
      data: {
        photo: {
          id: photo._id,
          images: photo.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: photo.title,
          desc: photo.desc,
          total_likes: photo.total_likes,
          tag_label: photo.tag_label,
          posted: photo.posted,
          template_frame: photo.template_frame_id ? {
            id: photo.template_frame_id._id,
            title: photo.template_frame_id.title,
            layout_type: photo.template_frame_id.layout_type,
            official_status: photo.template_frame_id.official_status
          } : null,
          user: {
            id: photo.user_id._id,
            name: photo.user_id.name,
            username: photo.user_id.username,
            image_profile: photo.user_id.image_profile,
            role: photo.user_id.role
          },
          created_at: photo.created_at,
          updated_at: photo.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Edit photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;