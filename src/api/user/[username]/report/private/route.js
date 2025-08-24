const express = require('express');
const { param, body, query, validationResult } = require('express-validator');
const Report = require('../../../../../models/Report');
const Frame = require('../../../../../models/Frame');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');

const router = express.Router();


router.get('/:username/report/private', [
  param('username').notEmpty().withMessage('Username is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['pending', 'done', 'rejected']).withMessage('Invalid status')
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
        message: 'Access denied. You can only view your own reports.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user_id: targetUser._id };

    if (req.query.status) {
      filter.report_status = req.query.status;
    }

    const reports = await Report.find(filter)
      .populate('frame_id', 'title images user_id layout_type')
      .populate('admin_id', 'name username role')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Report.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reports: reports.map(report => ({
          id: report._id,
          title: report.title,
          description: report.description,
          report_status: report.report_status,
          admin_response: report.admin_response,
          frame: report.frame_id ? {
            id: report.frame_id._id,
            title: report.frame_id.title,
            images: report.frame_id.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
            layout_type: report.frame_id.layout_type
          } : null,
          admin: report.admin_id ? {
            id: report.admin_id._id,
            name: report.admin_id.name,
            username: report.admin_id.username,
            role: report.admin_id.role
          } : null,
          created_at: report.created_at,
          updated_at: report.updated_at
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
    console.error('Get user reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


router.post('/:username/report/private', [
  param('username').notEmpty().withMessage('Username is required'),
  body('title').notEmpty().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be 1-200 characters'),
  body('description').notEmpty().isLength({ min: 1, max: 1000 }).withMessage('Description is required and must be 1-1000 characters'),
  body('frame_id').isMongoId().withMessage('Valid frame ID is required')
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
        message: 'Access denied. You can only create reports for yourself.'
      });
    }

    const { title, description, frame_id } = req.body;


    const frame = await Frame.findOne({
      _id: frame_id,
      visibility: 'public'
    }).populate('user_id', 'name username');

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found or not public'
      });
    }


    if (frame.user_id._id.toString() === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report your own frame'
      });
    }


    const existingReport = await Report.findOne({
      user_id: targetUser._id,
      frame_id
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this frame',
        data: {
          existing_report: {
            id: existingReport._id,
            status: existingReport.report_status,
            created_at: existingReport.created_at
          }
        }
      });
    }

    const newReport = new Report({
      title: title.trim(),
      description: description.trim(),
      frame_id,
      user_id: targetUser._id
    });

    await newReport.save();
    await newReport.populate([
      { path: 'frame_id', select: 'title images layout_type user_id', populate: { path: 'user_id', select: 'name username' } },
      { path: 'admin_id', select: 'name username role' }
    ]);

    console.log(`REPORT SUBMITTED: User ${targetUser.username} reported frame ${frame_id} by ${frame.user_id.username}`);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: {
        report: {
          id: newReport._id,
          title: newReport.title,
          description: newReport.description,
          report_status: newReport.report_status,
          admin_response: newReport.admin_response,
          frame: {
            id: newReport.frame_id._id,
            title: newReport.frame_id.title,
            images: newReport.frame_id.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
            layout_type: newReport.frame_id.layout_type,
            owner: {
              id: newReport.frame_id.user_id._id,
              name: newReport.frame_id.user_id.name,
              username: newReport.frame_id.user_id.username
            }
          },
          admin: null,
          created_at: newReport.created_at,
          updated_at: newReport.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Submit report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;