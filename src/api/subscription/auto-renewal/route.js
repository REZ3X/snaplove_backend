const express = require('express');
const router = express.Router();
const Subscription = require('../../../models/Subscription');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');

/**
 * Toggle auto-renewal
 * PATCH /api/subscription/auto-renewal
 */
router.patch('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const { enabled } = req.body;
        const userId = req.user.userId;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'enabled field must be a boolean'
            });
        }


        const subscription = await Subscription.findOne({
            user: userId,
            status: { $in: ['success', 'cancelled'] }
        }).sort({ created_at: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }


        if (subscription.status === 'refunded') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify refunded subscription'
            });
        }


        subscription.auto_renewal_enabled = enabled;


        if (enabled) {
            subscription.renewal_attempted = false;
            subscription.renewal_attempt_count = 0;
            subscription.status = 'success';
            subscription.metadata = {
                ...subscription.metadata,
                reminder_7_days_sent: false,
                reminder_3_days_sent: false,
                reminder_1_day_sent: false
            };
        }

        await subscription.save();

        return res.status(200).json({
            success: true,
            message: enabled ? 'Auto-renewal enabled' : 'Auto-renewal disabled',
            auto_renewal_enabled: subscription.auto_renewal_enabled,
            next_billing_date: subscription.subscription_end_date
        });

    } catch (error) {
        console.error('❌ Toggle auto-renewal error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update auto-renewal setting',
            error: error.message
        });
    }
});

module.exports = router;
