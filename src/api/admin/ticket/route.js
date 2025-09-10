const express = require('express');
const { query, validationResult } = require('express-validator');
const Ticket = require('../../../models/Ticket');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../middleware/middleware');
const { getDisplayProfileImage } = require('../../../utils/profileImageHelper');

const router = express.Router();

router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['suggestion', 'critics', 'other']).withMessage('Invalid ticket type'),
  query('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sort').optional().isIn(['newest', 'oldest', 'priority_high', 'priority_low']).withMessage('Invalid sort option')
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

    const filter = {};

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { created_at: 1 };
        break;
      case 'priority_high':
        sort = {
          priority: 1,
          created_at: -1
        };
        break;
      case 'priority_low':
        sort = {
          priority: -1,
          created_at: -1
        };
        break;
      default:
        sort = { created_at: -1 };
    }

    let aggregationPipeline = [];

    if (req.query.sort === 'priority_high' || req.query.sort === 'priority_low') {
      const priorityOrder = req.query.sort === 'priority_high'
        ? { urgent: 1, high: 2, medium: 3, low: 4 }
        : { low: 1, medium: 2, high: 3, urgent: 4 };

      aggregationPipeline = [
        { $match: filter },
        {
          $addFields: {
            priorityOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'urgent'] }, then: priorityOrder.urgent },
                  { case: { $eq: ['$priority', 'high'] }, then: priorityOrder.high },
                  { case: { $eq: ['$priority', 'medium'] }, then: priorityOrder.medium },
                  { case: { $eq: ['$priority', 'low'] }, then: priorityOrder.low }
                ],
                default: 5
              }
            }
          }
        },
        { $sort: { priorityOrder: 1, created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user_id'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'admin_id',
            foreignField: '_id',
            as: 'admin_id'
          }
        },
        { $unwind: '$user_id' },
        {
          $unwind: {
            path: '$admin_id',
            preserveNullAndEmptyArrays: true
          }
        }
      ];
    }

    let tickets;
    if (aggregationPipeline.length > 0) {
      tickets = await Ticket.aggregate(aggregationPipeline);
    } else {
      tickets = await Ticket.find(filter)
        .populate('user_id', 'name username image_profile role')
        .populate('admin_id', 'name username role')
        .sort(sort)
        .skip(skip)
        .limit(limit);
    }

    const total = await Ticket.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          suggestions: { $sum: { $cond: [{ $eq: ['$type', 'suggestion'] }, 1, 0] } },
          critics: { $sum: { $cond: [{ $eq: ['$type', 'critics'] }, 1, 0] } },
          other: { $sum: { $cond: [{ $eq: ['$type', 'other'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        tickets: tickets.map(ticket => ({
          id: ticket._id,
          title: ticket.title,
          description: ticket.description.length > 150
            ? ticket.description.substring(0, 150) + '...'
            : ticket.description,
          images: ticket.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
          type: ticket.type,
          status: ticket.status,
          priority: ticket.priority,
          admin_response: ticket.admin_response,
          user: {
            id: ticket.user_id._id,
            name: ticket.user_id.name,
            username: ticket.user_id.username,
            image_profile: getDisplayProfileImage(ticket.user_id, req),
            role: ticket.user_id.role
          },
          admin: ticket.admin_id ? {
            id: ticket.admin_id._id,
            name: ticket.admin_id.name,
            username: ticket.admin_id.username,
            role: ticket.admin_id.role
          } : null,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at
        })),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        statistics: stats[0] || {
          total: 0,
          pending: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
          urgent: 0,
          high: 0,
          suggestions: 0,
          critics: 0,
          other: 0
        }
      }
    });

  } catch (error) {
    console.error('Admin get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;