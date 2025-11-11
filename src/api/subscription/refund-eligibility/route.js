const express = require('express');
const router = express.Router();
const Subscription = require('../../../models/Subscription');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');

/**
 * Check refund eligibility
 * GET /api/subscription/refund-eligibility
 */
router.get('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.userId;


        const subscription = await Subscription.findOne({
            user: userId,
            status: { $in: ['success', 'cancelled'] }
        }).sort({ created_at: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found',
                eligible: false,
                days_since_payment: null,
                days_remaining: null
            });
        }


        if (subscription.status === 'refunded') {
            return res.status(200).json({
                success: true,
                eligible: false,
                message: 'Subscription has already been refunded',
                days_since_payment: null,
                days_remaining: 0,
                refund_reference: subscription.refund_reference,
                refunded_at: subscription.refunded_at
            });
        }


        const daysSincePayment = Math.floor(
            (Date.now() - subscription.paid_at.getTime()) / (1000 * 60 * 60 * 24)
        );

        const daysRemaining = Math.max(0, 5 - daysSincePayment);
        const eligible = daysSincePayment <= 5;

        const refundDeadline = new Date(subscription.paid_at.getTime() + 5 * 24 * 60 * 60 * 1000);

        return res.status(200).json({
            success: true,
            eligible,
            days_since_payment: daysSincePayment,
            days_remaining: daysRemaining,
            refund_amount: subscription.amount,
            refund_deadline: refundDeadline,
            paid_at: subscription.paid_at,
            message: eligible
                ? `You have ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left to request a full refund`
                : 'Refund period has expired. You can still cancel to stop auto-renewal.'
        });

    } catch (error) {
        console.error('❌ Check refund eligibility error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check refund eligibility',
            error: error.message
        });
    }
});

module.exports = router;
