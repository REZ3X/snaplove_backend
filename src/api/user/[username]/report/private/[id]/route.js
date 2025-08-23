const express = require('express');
const { param, validationResult } = require('express-validator');
const Report = require('../../../../../../models/Report');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware');

const router = express.Router();

router.get('/:username/report/private/:id', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid report ID')
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

    const report = await Report.findOne({ 
      _id: req.params.id,
      user_id: targetUser._id
    })
      .populate('frame_id', 'title images layout_type user_id', null, { populate: { path: 'user_id', select: 'name username' } })
      .populate('admin_id', 'name username role');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: {
        report: {
          id: report._id,
          title: report.title,
          description: report.description,
          report_status: report.report_status,
          admin_response: report.admin_response,
          frame: report.frame_id ? {
            id: report.frame_id._id,
            title: report.frame_id.title,
            images: report.frame_id.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
            layout_type: report.frame_id.layout_type,
            owner: report.frame_id.user_id ? {
              id: report.frame_id.user_id._id,
              name: report.frame_id.user_id.name,
              username: report.frame_id.user_id.username
            } : null
          } : null,
          admin: report.admin_id ? {
            id: report.admin_id._id,
            name: report.admin_id.name,
            username: report.admin_id.username,
            role: report.admin_id.role
          } : null,
          created_at: report.created_at,
          updated_at: report.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get report by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;