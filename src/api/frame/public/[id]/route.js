const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../models/Frame');

const router = express.Router();

router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid frame ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const frame = await Frame.findOne({ 
      _id: req.params.id, 
      visibility: 'public' 
    }).populate('user_id', 'name username image_profile role');

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    res.json({
      success: true,
      data: {
        frame: {
          id: frame._id,
          images: frame.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
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
    console.error('Get frame by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;