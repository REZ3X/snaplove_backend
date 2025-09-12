const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const Broadcast = require('../../../models/Broadcast');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../middleware/middleware');
const socketService = require('../../../services/socketService');

const router = express.Router();


router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['draft', 'scheduled', 'sent', 'cancelled']).withMessage('Invalid status'),
    query('type').optional().isIn(['announcement', 'maintenance', 'update', 'alert', 'celebration', 'general']).withMessage('Invalid type'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be 1-100 characters')
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

        if (req.query.status) {
            filter.status = req.query.status;
        }

        if (req.query.type) {
            filter.type = req.query.type;
        }

        if (req.query.priority) {
            filter.priority = req.query.priority;
        }

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            filter.$or = [
                { title: searchRegex },
                { message: searchRegex }
            ];
        }


        const broadcasts = await Broadcast.find(filter)
            .populate('created_by', 'name username role')
            .populate('sent_by', 'name username role')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Broadcast.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);


        const stats = await Broadcast.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
                    scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
                    sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                    total_recipients: { $sum: '$total_recipients' },
                    total_notifications: { $sum: '$notifications_created' }
                }
            }
        ]);

        const formattedBroadcasts = broadcasts.map(broadcast => ({
            id: broadcast._id,
            title: broadcast.title,
            message: broadcast.message.length > 100 ? broadcast.message.substring(0, 100) + '...' : broadcast.message,
            full_message: broadcast.message,
            type: broadcast.type,
            type_emoji: broadcast.type_emoji,
            priority: broadcast.priority,
            priority_emoji: broadcast.priority_emoji,
            target_audience: broadcast.target_audience,
            target_roles: broadcast.target_roles,
            status: broadcast.status,
            scheduled_at: broadcast.scheduled_at,
            sent_at: broadcast.sent_at,
            expires_at: broadcast.expires_at,
            created_by: {
                id: broadcast.created_by._id,
                name: broadcast.created_by.name,
                username: broadcast.created_by.username,
                role: broadcast.created_by.role
            },
            sent_by: broadcast.sent_by ? {
                id: broadcast.sent_by._id,
                name: broadcast.sent_by.name,
                username: broadcast.sent_by.username,
                role: broadcast.sent_by.role
            } : null,
            statistics: {
                total_recipients: broadcast.total_recipients,
                notifications_created: broadcast.notifications_created,
                delivery_stats: broadcast.delivery_stats
            },
            settings: broadcast.settings,
            created_at: broadcast.created_at,
            updated_at: broadcast.updated_at
        }));

        res.json({
            success: true,
            data: {
                broadcasts: formattedBroadcasts,
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
                    draft: 0,
                    scheduled: 0,
                    sent: 0,
                    cancelled: 0,
                    total_recipients: 0,
                    total_notifications: 0
                }
            }
        });

    } catch (error) {
        console.error('Get broadcasts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.post('/', [
    body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
    body('message').isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters'),
    body('type').optional().isIn(['announcement', 'maintenance', 'update', 'alert', 'celebration', 'general']).withMessage('Invalid type'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('target_audience').optional().isIn(['all', 'verified', 'premium', 'basic', 'official', 'developer', 'online_users']).withMessage('Invalid target audience'),
    body('target_roles').optional().isArray().withMessage('Target roles must be an array'),
    body('scheduled_at').optional().isISO8601().withMessage('Invalid scheduled date'),
    body('expires_at').optional().isISO8601().withMessage('Invalid expiration date'),
    body('settings.send_to_new_users').optional().isBoolean().withMessage('Send to new users must be boolean'),
    body('settings.persistent').optional().isBoolean().withMessage('Persistent must be boolean'),
    body('settings.dismissible').optional().isBoolean().withMessage('Dismissible must be boolean'),
    body('settings.action_url').optional().isURL().withMessage('Invalid action URL'),
    body('send_immediately').optional().isBoolean().withMessage('Send immediately must be boolean')
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

        const {
            title,
            message,
            type = 'general',
            priority = 'medium',
            target_audience = 'all',
            target_roles = [],
            scheduled_at,
            expires_at,
            settings = {},
            metadata = {},
            send_immediately = false
        } = req.body;


        if (scheduled_at && new Date(scheduled_at) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in the future'
            });
        }


        if (expires_at && new Date(expires_at) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Expiration time must be in the future'
            });
        }

        const broadcast = new Broadcast({
            title: title.trim(),
            message: message.trim(),
            type,
            priority,
            target_audience,
            target_roles: target_audience === 'all' ? [] : target_roles,
            status: send_immediately ? 'sent' : (scheduled_at ? 'scheduled' : 'draft'),
            scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
            expires_at: expires_at ? new Date(expires_at) : null,
            created_by: req.user.userId,
            sent_by: send_immediately ? req.user.userId : null,
            sent_at: send_immediately ? new Date() : null,
            settings: {
                send_to_new_users: settings.send_to_new_users || false,
                persistent: settings.persistent !== false,
                dismissible: settings.dismissible !== false,
                action_url: settings.action_url || null,
                icon: settings.icon || null,
                color: settings.color || null
            },
            metadata
        });

        await broadcast.save();
        await broadcast.populate([
            { path: 'created_by', select: 'name username role' },
            { path: 'sent_by', select: 'name username role' }
        ]);


        if (send_immediately) {
            try {
                const deliveryStats = await socketService.sendBroadcastNotification(broadcast);


                broadcast.total_recipients = deliveryStats.total_recipients;
                broadcast.notifications_created = deliveryStats.notifications_created;
                broadcast.delivery_stats = deliveryStats.delivery_stats;
                await broadcast.save();

                console.log(`📢 BROADCAST SENT: Admin ${req.user.userId} sent broadcast "${broadcast.title}" to ${deliveryStats.total_recipients} users`);
            } catch (broadcastError) {
                console.error('Failed to send broadcast immediately:', broadcastError);

                broadcast.status = 'draft';
                broadcast.sent_at = null;
                broadcast.sent_by = null;
                await broadcast.save();

                return res.status(500).json({
                    success: false,
                    message: 'Broadcast created but failed to send immediately. It has been saved as draft.',
                    data: { broadcast_id: broadcast._id }
                });
            }
        }

        res.status(201).json({
            success: true,
            message: send_immediately ? 'Broadcast sent successfully' : 'Broadcast created successfully',
            data: {
                broadcast: {
                    id: broadcast._id,
                    title: broadcast.title,
                    message: broadcast.message,
                    type: broadcast.type,
                    priority: broadcast.priority,
                    status: broadcast.status,
                    target_audience: broadcast.target_audience,
                    target_roles: broadcast.target_roles,
                    scheduled_at: broadcast.scheduled_at,
                    expires_at: broadcast.expires_at,
                    statistics: {
                        total_recipients: broadcast.total_recipients,
                        notifications_created: broadcast.notifications_created,
                        delivery_stats: broadcast.delivery_stats
                    },
                    created_at: broadcast.created_at
                }
            }
        });

    } catch (error) {
        console.error('Create broadcast error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid broadcast ID')
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

        const broadcast = await Broadcast.findById(req.params.id)
            .populate('created_by', 'name username role email')
            .populate('sent_by', 'name username role');

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: 'Broadcast not found'
            });
        }

        res.json({
            success: true,
            data: {
                broadcast: {
                    id: broadcast._id,
                    title: broadcast.title,
                    message: broadcast.message,
                    type: broadcast.type,
                    type_emoji: broadcast.type_emoji,
                    priority: broadcast.priority,
                    priority_emoji: broadcast.priority_emoji,
                    target_audience: broadcast.target_audience,
                    target_roles: broadcast.target_roles,
                    status: broadcast.status,
                    scheduled_at: broadcast.scheduled_at,
                    sent_at: broadcast.sent_at,
                    expires_at: broadcast.expires_at,
                    created_by: broadcast.created_by,
                    sent_by: broadcast.sent_by,
                    statistics: {
                        total_recipients: broadcast.total_recipients,
                        notifications_created: broadcast.notifications_created,
                        delivery_stats: broadcast.delivery_stats
                    },
                    settings: broadcast.settings,
                    metadata: broadcast.metadata,
                    created_at: broadcast.created_at,
                    updated_at: broadcast.updated_at
                }
            }
        });

    } catch (error) {
        console.error('Get broadcast by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.post('/:id/send', [
    param('id').isMongoId().withMessage('Invalid broadcast ID')
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

        const broadcast = await Broadcast.findById(req.params.id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: 'Broadcast not found'
            });
        }

        if (broadcast.status === 'sent') {
            return res.status(400).json({
                success: false,
                message: 'Broadcast has already been sent'
            });
        }

        if (broadcast.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot send cancelled broadcast'
            });
        }


        const deliveryStats = await socketService.sendBroadcastNotification(broadcast);


        broadcast.status = 'sent';
        broadcast.sent_at = new Date();
        broadcast.sent_by = req.user.userId;
        broadcast.total_recipients = deliveryStats.total_recipients;
        broadcast.notifications_created = deliveryStats.notifications_created;
        broadcast.delivery_stats = deliveryStats.delivery_stats;

        await broadcast.save();

        console.log(`📢 BROADCAST SENT: Admin ${req.user.userId} sent broadcast "${broadcast.title}" to ${deliveryStats.total_recipients} users`);

        res.json({
            success: true,
            message: 'Broadcast sent successfully',
            data: {
                broadcast_id: broadcast._id,
                delivery_statistics: deliveryStats
            }
        });

    } catch (error) {
        console.error('Send broadcast error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.put('/:id', [
    param('id').isMongoId().withMessage('Invalid broadcast ID'),
    body('title').optional().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
    body('message').optional().isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters'),
    body('type').optional().isIn(['announcement', 'maintenance', 'update', 'alert', 'celebration', 'general']).withMessage('Invalid type'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('target_audience').optional().isIn(['all', 'verified', 'premium', 'basic', 'official', 'developer', 'online_users']).withMessage('Invalid target audience'),
    body('scheduled_at').optional().isISO8601().withMessage('Invalid scheduled date'),
    body('expires_at').optional().isISO8601().withMessage('Invalid expiration date')
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

        const broadcast = await Broadcast.findById(req.params.id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: 'Broadcast not found'
            });
        }

        if (!['draft', 'scheduled'].includes(broadcast.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only draft and scheduled broadcasts can be updated'
            });
        }

        const updateData = {};
        const changes = [];


        const updatableFields = ['title', 'message', 'type', 'priority', 'target_audience', 'target_roles', 'scheduled_at', 'expires_at', 'settings', 'metadata'];

        updatableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'title' || field === 'message') {
                    updateData[field] = req.body[field].trim();
                } else {
                    updateData[field] = req.body[field];
                }
                changes.push(`${field} updated`);
            }
        });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No changes detected'
            });
        }

        const updatedBroadcast = await Broadcast.findByIdAndUpdate(
            broadcast._id,
            updateData,
            { new: true }
        ).populate([
            { path: 'created_by', select: 'name username role' },
            { path: 'sent_by', select: 'name username role' }
        ]);

        console.log(`📢 BROADCAST UPDATED: Admin ${req.user.userId} updated broadcast ${broadcast._id}. Changes: ${changes.join(', ')}`);

        res.json({
            success: true,
            message: 'Broadcast updated successfully',
            data: {
                broadcast: {
                    id: updatedBroadcast._id,
                    title: updatedBroadcast.title,
                    message: updatedBroadcast.message,
                    type: updatedBroadcast.type,
                    priority: updatedBroadcast.priority,
                    status: updatedBroadcast.status,
                    target_audience: updatedBroadcast.target_audience,
                    target_roles: updatedBroadcast.target_roles,
                    scheduled_at: updatedBroadcast.scheduled_at,
                    expires_at: updatedBroadcast.expires_at,
                    settings: updatedBroadcast.settings,
                    metadata: updatedBroadcast.metadata,
                    updated_at: updatedBroadcast.updated_at
                },
                changes
            }
        });

    } catch (error) {
        console.error('Update broadcast error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.delete('/:id/cancel', [
    param('id').isMongoId().withMessage('Invalid broadcast ID')
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

        const broadcast = await Broadcast.findById(req.params.id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: 'Broadcast not found'
            });
        }

        if (broadcast.status !== 'scheduled') {
            return res.status(400).json({
                success: false,
                message: 'Only scheduled broadcasts can be cancelled'
            });
        }

        broadcast.status = 'cancelled';
        await broadcast.save();

        console.log(`📢 BROADCAST CANCELLED: Admin ${req.user.userId} cancelled broadcast ${broadcast._id}`);

        res.json({
            success: true,
            message: 'Broadcast cancelled successfully',
            data: {
                broadcast_id: broadcast._id,
                status: broadcast.status
            }
        });

    } catch (error) {
        console.error('Cancel broadcast error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.delete('/:id', [
    param('id').isMongoId().withMessage('Invalid broadcast ID')
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

        const broadcast = await Broadcast.findById(req.params.id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: 'Broadcast not found'
            });
        }

        if (!['draft', 'cancelled'].includes(broadcast.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only draft and cancelled broadcasts can be deleted'
            });
        }

        await Broadcast.findByIdAndDelete(broadcast._id);

        console.log(`📢 BROADCAST DELETED: Admin ${req.user.userId} deleted broadcast ${broadcast._id}`);

        res.json({
            success: true,
            message: 'Broadcast deleted successfully'
        });

    } catch (error) {
        console.error('Delete broadcast error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;