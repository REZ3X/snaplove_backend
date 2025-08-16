const express = require('express');
const { param, validationResult } = require('express-validator');
const Ticket = require('../../../../../../models/Ticket');
const User = require('../../../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../../../middleware');

const router = express.Router();

router.get('/:username/ticket/private/:id', [
  param('username').notEmpty().withMessage('Username is required'),
  param('id').isMongoId().withMessage('Invalid ticket ID')
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

    const ticket = await Ticket.findOne({ 
      _id: req.params.id,
      user_id: targetUser._id
    })
      .populate('user_id', 'name username image_profile role')
      .populate('admin_id', 'name username role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: {
        ticket: {
          id: ticket._id,
          title: ticket.title,
          description: ticket.description,
          images: ticket.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          type: ticket.type,
          status: ticket.status,
          priority: ticket.priority,
          admin_response: ticket.admin_response,
          user: {
            id: ticket.user_id._id,
            name: ticket.user_id.name,
            username: ticket.user_id.username,
            image_profile: ticket.user_id.image_profile,
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
        }
      }
    });

  } catch (error) {
    console.error('Get ticket by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;