const express = require('express');
const { param, body, validationResult } = require('express-validator');
const Ticket = require('../../../../models/Ticket');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../middleware/middleware');

const router = express.Router();

router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid ticket ID')
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

    const ticket = await Ticket.findById(req.params.id)
      .populate('user_id', 'name username image_profile role email')
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
            email: ticket.user_id.email,
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
    console.error('Admin get ticket detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid ticket ID'),
  body('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('admin_response').optional().isLength({ min: 1, max: 2000 }).withMessage('Admin response must be 1-2000 characters')
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

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const { status, priority, admin_response } = req.body;
    const updateData = {};
    const changes = [];

    if (status !== undefined && status !== ticket.status) {
      updateData.status = status;
      changes.push(`Status changed from ${ticket.status} to ${status}`);
    }

    if (priority !== undefined && priority !== ticket.priority) {
      updateData.priority = priority;
      changes.push(`Priority changed from ${ticket.priority} to ${priority}`);
    }

    if (admin_response !== undefined) {
      updateData.admin_response = admin_response.trim();
      updateData.admin_id = req.user.userId;
      changes.push('Admin response added/updated');
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected'
      });
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticket._id,
      updateData,
      { new: true }
    )
      .populate('user_id', 'name username image_profile role email')
      .populate('admin_id', 'name username role');

    console.log(`ADMIN UPDATE: Admin ${req.user.userId} updated ticket ${ticket._id}. Changes: ${changes.join(', ')}`);

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: {
        ticket: {
          id: updatedTicket._id,
          title: updatedTicket.title,
          description: updatedTicket.description,
          images: updatedTicket.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
          type: updatedTicket.type,
          status: updatedTicket.status,
          priority: updatedTicket.priority,
          admin_response: updatedTicket.admin_response,
          user: {
            id: updatedTicket.user_id._id,
            name: updatedTicket.user_id.name,
            username: updatedTicket.user_id.username,
            email: updatedTicket.user_id.email,
            image_profile: updatedTicket.user_id.image_profile,
            role: updatedTicket.user_id.role
          },
          admin: updatedTicket.admin_id ? {
            id: updatedTicket.admin_id._id,
            name: updatedTicket.admin_id.name,
            username: updatedTicket.admin_id.username,
            role: updatedTicket.admin_id.role
          } : null,
          created_at: updatedTicket.created_at,
          updated_at: updatedTicket.updated_at
        },
        changes,
        admin_action: {
          admin_id: req.user.userId,
          action: 'UPDATE_TICKET',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Admin update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;