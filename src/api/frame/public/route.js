const express = require('express');
const { query, validationResult } = require('express-validator');
const Frame = require('../../../models/Frame');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');
const { canCreatePublicFrame } = require('../../../utils/RolePolicy');
const socketService = require('../../../services/socketService');

const router = express.Router();

router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('layout_type').optional().isIn(['2x1', '3x1', '4x1']).withMessage('Invalid layout type'),
  query('tag').optional().isString().withMessage('Tag must be a string'),
  query('sort').optional().isIn(['newest', 'oldest', 'most_liked', 'most_used']).withMessage('Invalid sort option')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {
      visibility: 'public',
      approval_status: 'approved'
    };

    if (req.query.layout_type) {
      filter.layout_type = req.query.layout_type;
    }

    if (req.query.tag) {
      filter.tag_label = { $in: [req.query.tag] };
    }

    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { created_at: 1 };
        break;
      case 'most_liked':
        sort = { 'like_count': -1, created_at: -1 };
        break;
      case 'most_used':
        sort = { 'use_count': -1, created_at: -1 };
        break;
      default:
        sort = { created_at: -1 };
    }

    const frames = await Frame.find(filter)
      .populate('user_id', 'name username image_profile role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Frame.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        frames: frames.map(frame => ({
          id: frame._id,
          thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
          title: frame.title,
          desc: frame.desc,
          total_likes: frame.total_likes,
          total_uses: frame.total_uses,
          layout_type: frame.layout_type,
          official_status: frame.official_status,
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
        })),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get public frames error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/', authenticateToken, checkBanStatus, async (req, res) => {
  const imageHandler = require('../../../utils/LocalImageHandler');
  const upload = imageHandler.getFrameUpload();

  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'thumbnail', maxCount: 1 }
  ])(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      const { title, desc, layout_type, visibility, tag_label } = req.body;

      if (!title || !layout_type) {
        return res.status(400).json({
          success: false,
          message: 'Title and layout_type are required'
        });
      }

      if (!req.files || !req.files.images || req.files.images.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one frame image is required'
        });
      }

      if (!['2x1', '3x1', '4x1'].includes(layout_type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid layout_type'
        });
      }

      const frameVisibility = visibility || 'private';


      if (frameVisibility === 'public') {
        if (!req.files.thumbnail || req.files.thumbnail.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Thumbnail is required for public frames'
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
      }

      const User = require('../../../models/User');
      const user = await User.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const images = req.files.images.map(file => imageHandler.getRelativeImagePath(file.path));

      const thumbnail = req.files.thumbnail ? imageHandler.getRelativeImagePath(req.files.thumbnail[0].path) : null;

      let tags = [];
      if (tag_label) {
        if (Array.isArray(tag_label)) {
          tags = tag_label;
        } else if (typeof tag_label === 'string') {
          tags = tag_label.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
      }

      const newFrame = new Frame({
        images,
        thumbnail,
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        layout_type,
        official_status: ['official', 'developer'].includes(user.role),
        visibility: frameVisibility,
        approval_status: ['official', 'developer'].includes(user.role) ? 'approved' : 'pending',
        tag_label: tags,
        user_id: req.user.userId
      });

      await newFrame.save();
      await newFrame.populate('user_id', 'name username image_profile role');

      try {
        if (frameVisibility === 'public') {
          await socketService.sendFrameUploadNotification(
            req.user.userId,
            {
              id: newFrame._id,
              title: newFrame.title,
              thumbnail: newFrame.thumbnail,
              layout_type: newFrame.layout_type,
              owner_name: user.name,
              owner_username: user.username
            }
          );
        }
      } catch (notifError) {
        console.error('Failed to send frame upload notifications:', notifError);
      }

      console.log(`FRAME CREATED: User ${user.username} created a ${frameVisibility} frame: ${newFrame.title}`);

      res.status(201).json({
        success: true,
        message: `Frame created successfully as ${frameVisibility}`,
        data: {
          frame: {
            id: newFrame._id,
            images: newFrame.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            thumbnail: newFrame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + newFrame.thumbnail : null,
            title: newFrame.title,
            desc: newFrame.desc,
            total_likes: newFrame.total_likes,
            total_uses: newFrame.total_uses,
            layout_type: newFrame.layout_type,
            official_status: newFrame.official_status,
            visibility: newFrame.visibility,
            tag_label: newFrame.tag_label,
            user: {
              id: newFrame.user_id._id,
              name: newFrame.user_id.name,
              username: newFrame.user_id.username,
              image_profile: newFrame.user_id.image_profile,
              role: newFrame.user_id.role
            },
            created_at: newFrame.created_at,
            updated_at: newFrame.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Create frame error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
});

module.exports = router;