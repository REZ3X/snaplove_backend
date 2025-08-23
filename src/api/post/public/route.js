const express = require('express');
const { query, validationResult } = require('express-validator');
const PhotoPost = require('../../../models/PhotoPost');
const { authenticateToken } = require('../../../middleware');

const router = express.Router();

router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('tag').optional().isString().withMessage('Tag must be a string'),
  query('sort').optional().isIn(['newest', 'oldest', 'most_liked']).withMessage('Invalid sort option'),
  query('has_frame').optional().isBoolean().withMessage('has_frame must be boolean')
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

    const filter = { posted: true };

    if (req.query.tag) {
      filter.tag_label = { $in: [req.query.tag] };
    }

    if (req.query.has_frame === 'true') {
      filter.template_frame_id = { $ne: null };
    } else if (req.query.has_frame === 'false') {
      filter.template_frame_id = null;
    }

    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { created_at: 1 };
        break;
      case 'most_liked':
        sort = { 'like_count': -1, created_at: -1 };
        break;
      default:
        sort = { created_at: -1 };
    }

    const posts = await PhotoPost.find(filter)
      .populate('user_id', 'name username image_profile role')
      .populate('template_frame_id', 'title layout_type official_status')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await PhotoPost.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        posts: posts.map(post => ({
          id: post._id,
          images: post.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          title: post.title,
          desc: post.desc,
          total_likes: post.total_likes,
          tag_label: post.tag_label,
          posted: post.posted,
          template_frame: post.template_frame_id ? {
            id: post.template_frame_id._id,
            title: post.template_frame_id.title,
            layout_type: post.template_frame_id.layout_type,
            official_status: post.template_frame_id.official_status
          } : null,
          user: {
            id: post.user_id._id,
            name: post.user_id.name,
            username: post.user_id.username,
            image_profile: post.user_id.image_profile,
            role: post.user_id.role
          },
          created_at: post.created_at,
          updated_at: post.updated_at
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
    console.error('Get public posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const imageHandler = require('../../../utils/LocalImageHandler');
  const upload = imageHandler.getPhotoUpload();

  upload.array('images', 20)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      const { title, desc, posted, template_frame_id, tag_label } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one image is required'
        });
      }

      let frameTemplate = null;
      if (template_frame_id) {
        const Frame = require('../../../models/Frame');
        frameTemplate = await Frame.findById(template_frame_id);
        if (!frameTemplate) {
          return res.status(400).json({
            success: false,
            message: 'Invalid template frame ID'
          });
        }
      }

      const images = req.files.map(file => imageHandler.getRelativeImagePath(file.path));

      let tags = [];
      if (tag_label) {
        if (Array.isArray(tag_label)) {
          tags = tag_label;
        } else if (typeof tag_label === 'string') {
          tags = tag_label.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
      }

      const newPost = new PhotoPost({
        images,
        title: title.trim(),
        desc: desc ? desc.trim() : '',
        posted: posted === 'true' || posted === true,
        template_frame_id: template_frame_id || null,
        tag_label: tags,
        user_id: req.user.userId
      });

      await newPost.save();
      await newPost.populate([
        { path: 'user_id', select: 'name username image_profile role' },
        { path: 'template_frame_id', select: 'title layout_type official_status' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Photo post created successfully',
        data: {
          post: {
            id: newPost._id,
            images: newPost.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            title: newPost.title,
            desc: newPost.desc,
            total_likes: newPost.total_likes,
            tag_label: newPost.tag_label,
            posted: newPost.posted,
            template_frame: newPost.template_frame_id ? {
              id: newPost.template_frame_id._id,
              title: newPost.template_frame_id.title,
              layout_type: newPost.template_frame_id.layout_type,
              official_status: newPost.template_frame_id.official_status
            } : null,
            user: {
              id: newPost.user_id._id,
              name: newPost.user_id.name,
              username: newPost.user_id.username,
              image_profile: newPost.user_id.image_profile,
              role: newPost.user_id.role
            },
            created_at: newPost.created_at,
            updated_at: newPost.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Create photo post error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
});

module.exports = router;