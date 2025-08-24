const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const Frame = require('../../../models/Frame');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../middleware/middleware');
const socketService = require('../../../services/socketService');

const router = express.Router();


router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'all']).withMessage('Invalid status'),
  query('sort').optional().isIn(['newest', 'oldest', 'title_asc', 'title_desc']).withMessage('Invalid sort option'),
  query('search').optional().isString().withMessage('Search must be a string')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
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

    const filter = { visibility: 'public' };


    const statusFilter = req.query.status || 'pending';
    if (statusFilter !== 'all') {
      filter.approval_status = statusFilter;
    }


    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { desc: searchRegex }
      ];
    }


    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { created_at: 1 };
        break;
      case 'title_asc':
        sort = { title: 1 };
        break;
      case 'title_desc':
        sort = { title: -1 };
        break;
      default:
        sort = { created_at: -1 };
    }

    const frames = await Frame.find(filter)
      .populate('user_id', 'name username image_profile role email')
      .populate('approved_by', 'name username role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Frame.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);


    const stats = await Frame.aggregate([
      { $match: { visibility: 'public' } },
      {
        $group: {
          _id: '$approval_status',
          count: { $sum: 1 },
          total_likes: { $sum: { $size: '$like_count' } },
          total_uses: { $sum: { $size: '$use_count' } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        frames: frames.map(frame => ({
          id: frame._id,
          thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
          title: frame.title,
          desc: frame.desc.length > 100 ? frame.desc.substring(0, 100) + '...' : frame.desc,
          layout_type: frame.layout_type,
          approval_status: frame.approval_status,
          official_status: frame.official_status,
          total_likes: frame.total_likes,
          total_uses: frame.total_uses,
          tag_label: frame.tag_label,
          user: {
            id: frame.user_id._id,
            name: frame.user_id.name,
            username: frame.user_id.username,
            image_profile: frame.user_id.image_profile,
            role: frame.user_id.role,
            email: frame.user_id.email
          },
          approved_by: frame.approved_by ? {
            id: frame.approved_by._id,
            name: frame.approved_by.name,
            username: frame.approved_by.username,
            role: frame.approved_by.role
          } : null,
          approved_at: frame.approved_at,
          rejection_reason: frame.rejection_reason,
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
        },
        statistics: {
          pending: stats.find(s => s._id === 'pending')?.count || 0,
          approved: stats.find(s => s._id === 'approved')?.count || 0,
          rejected: stats.find(s => s._id === 'rejected')?.count || 0,
          total: stats.reduce((sum, s) => sum + s.count, 0)
        }
      }
    });

  } catch (error) {
    console.error('Get frames for approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid frame ID')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
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
    })
      .populate('user_id', 'name username image_profile role email created_at')
      .populate('approved_by', 'name username role');

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
          thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
          title: frame.title,
          desc: frame.desc,
          layout_type: frame.layout_type,
          approval_status: frame.approval_status,
          official_status: frame.official_status,
          total_likes: frame.total_likes,
          total_uses: frame.total_uses,
          tag_label: frame.tag_label,
          user: {
            id: frame.user_id._id,
            name: frame.user_id.name,
            username: frame.user_id.username,
            image_profile: frame.user_id.image_profile,
            role: frame.user_id.role,
            email: frame.user_id.email,
            member_since: frame.user_id.created_at
          },
          approved_by: frame.approved_by ? {
            id: frame.approved_by._id,
            name: frame.approved_by.name,
            username: frame.approved_by.username,
            role: frame.approved_by.role
          } : null,
          approved_at: frame.approved_at,
          rejection_reason: frame.rejection_reason,
          created_at: frame.created_at,
          updated_at: frame.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get frame for approval detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid frame ID'),
  body('approval_status').isIn(['approved', 'rejected']).withMessage('Approval status must be approved or rejected'),
  body('rejection_reason').optional().isLength({ min: 1, max: 500 }).withMessage('Rejection reason must be 1-500 characters')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
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
    }).populate('user_id', 'name username email');

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const { approval_status, rejection_reason } = req.body;


    if (approval_status === 'rejected' && !rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a frame'
      });
    }

    const updateData = {
      approval_status,
      approved_by: req.user.userId,
      approved_at: new Date()
    };

    if (approval_status === 'rejected') {
      updateData.rejection_reason = rejection_reason.trim();
    } else {
      updateData.rejection_reason = null;
    }

    const updatedFrame = await Frame.findByIdAndUpdate(
      frame._id,
      updateData,
      { new: true }
    )
      .populate('user_id', 'name username image_profile role email')
      .populate('approved_by', 'name username role');

    console.log(`FRAME ${approval_status.toUpperCase()}: Admin ${req.user.userId} ${approval_status} frame ${frame._id} by ${frame.user_id.username}`);

    try {
      await socketService.sendFrameApprovalNotification(
        frame.user_id._id,
        {
          id: updatedFrame._id,
          title: updatedFrame.title,
          thumbnail: updatedFrame.thumbnail
        },
        approval_status,
        approval_status === 'rejected' ? rejection_reason : null
      );
    } catch (notifError) {
      console.error('Failed to send approval notification:', notifError);
    }

    res.json({
      success: true,
      message: `Frame ${approval_status} successfully`,
      data: {
        frame: {
          id: updatedFrame._id,
          thumbnail: updatedFrame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + updatedFrame.thumbnail : null,
          title: updatedFrame.title,
          desc: updatedFrame.desc,
          layout_type: updatedFrame.layout_type,
          approval_status: updatedFrame.approval_status,
          official_status: updatedFrame.official_status,
          total_likes: updatedFrame.total_likes,
          total_uses: updatedFrame.total_uses,
          tag_label: updatedFrame.tag_label,
          user: {
            id: updatedFrame.user_id._id,
            name: updatedFrame.user_id.name,
            username: updatedFrame.user_id.username,
            image_profile: updatedFrame.user_id.image_profile,
            role: updatedFrame.user_id.role,
            email: updatedFrame.user_id.email
          },
          approved_by: updatedFrame.approved_by ? {
            id: updatedFrame.approved_by._id,
            name: updatedFrame.approved_by.name,
            username: updatedFrame.approved_by.username,
            role: updatedFrame.approved_by.role
          } : null,
          approved_at: updatedFrame.approved_at,
          rejection_reason: updatedFrame.rejection_reason,
          created_at: updatedFrame.created_at,
          updated_at: updatedFrame.updated_at
        },
        admin_action: {
          admin_id: req.user.userId,
          action: `FRAME_${approval_status.toUpperCase()}`,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Update frame approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


router.post('/bulk', [
  body('frame_ids').isArray({ min: 1 }).withMessage('Frame IDs array is required'),
  body('frame_ids.*').isMongoId().withMessage('All frame IDs must be valid'),
  body('approval_status').isIn(['approved', 'rejected']).withMessage('Approval status must be approved or rejected'),
  body('rejection_reason').optional().isLength({ min: 1, max: 500 }).withMessage('Rejection reason must be 1-500 characters')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { frame_ids, approval_status, rejection_reason } = req.body;


    if (approval_status === 'rejected' && !rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting frames'
      });
    }

    const frames = await Frame.find({
      _id: { $in: frame_ids },
      visibility: 'public'
    });

    if (frames.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid frames found'
      });
    }

    const updateData = {
      approval_status,
      approved_by: req.user.userId,
      approved_at: new Date()
    };

    if (approval_status === 'rejected') {
      updateData.rejection_reason = rejection_reason.trim();
    } else {
      updateData.rejection_reason = null;
    }

    const result = await Frame.updateMany(
      { _id: { $in: frames.map(f => f._id) } },
      updateData
    );

    console.log(`BULK FRAME ${approval_status.toUpperCase()}: Admin ${req.user.userId} ${approval_status} ${result.modifiedCount} frames`);

    res.json({
      success: true,
      message: `${result.modifiedCount} frames ${approval_status} successfully`,
      data: {
        updated_count: result.modifiedCount,
        frame_ids: frames.map(f => f._id),
        approval_status,
        rejection_reason: approval_status === 'rejected' ? updateData.rejection_reason : null,
        admin_action: {
          admin_id: req.user.userId,
          action: `BULK_FRAME_${approval_status.toUpperCase()}`,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Bulk frame approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;