const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Ticket = require('../../../../../models/Ticket');
const User = require('../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');

const router = express.Router();

router.get('/:username/ticket/private', [
  param('username').notEmpty().withMessage('Username is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('type').optional().isIn(['suggestion', 'critics', 'other']).withMessage('Invalid ticket type'),
  query('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status')
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
        message: 'Access denied. You can only view your own tickets.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user_id: targetUser._id };

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const tickets = await Ticket.find(filter)
      .populate('admin_id', 'name username role')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Ticket.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        tickets: tickets.map(ticket => ({
          id: ticket._id,
          title: ticket.title,
          description: ticket.description,
          images: ticket.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          type: ticket.type,
          status: ticket.status,
          priority: ticket.priority,
          admin_response: ticket.admin_response,
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
        }
      }
    });

  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/:username/ticket/private', [
  param('username').notEmpty().withMessage('Username is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  const imageHandler = require('../../../../../utils/LocalImageHandler');
  const upload = imageHandler.getTicketUpload();

  upload.array('images', 3)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
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
          message: 'Access denied. You can only create tickets for yourself.'
        });
      }

      const { title, description, type } = req.body;

      if (!title || !description || !type) {
        return res.status(400).json({
          success: false,
          message: 'Title, description, and type are required'
        });
      }

      if (!['suggestion', 'critics', 'other'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ticket type'
        });
      }

      const images = req.files ? req.files.map(file => imageHandler.getRelativeImagePath(file.path)) : [];

      const newTicket = new Ticket({
        title: title.trim(),
        description: description.trim(),
        user_id: targetUser._id,
        images,
        type
      });

      await newTicket.save();

      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: {
          ticket: {
            id: newTicket._id,
            title: newTicket.title,
            description: newTicket.description,
            images: newTicket.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            type: newTicket.type,
            status: newTicket.status,
            priority: newTicket.priority,
            admin_response: newTicket.admin_response,
            admin: null,
            created_at: newTicket.created_at,
            updated_at: newTicket.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Create ticket error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
});

module.exports = router;