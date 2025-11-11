const express = require('express');
const router = express.Router();
const Subscription = require('../../../models/Subscription');
const User = require('../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');
const duitkuService = require('../../../services/duitkuService');
const mailService = require('../../../services/mailService');

/**
 * Cancel subscription
 * POST /api/subscription/cancel
 */
router.post('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const { cancellation_reason, request_refund } = req.body;
        const userId = req.user.userId;


        const subscription = await Subscription.findOne({
            user: userId,
            status: 'success'
        }).sort({ created_at: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }


        if (subscription.status === 'cancelled' || subscription.status === 'refunded') {
            return res.status(400).json({
                success: false,
                message: 'Subscription is already cancelled'
            });
        }


        const daysSincePayment = Math.floor(
            (Date.now() - subscription.paid_at.getTime()) / (1000 * 60 * 60 * 24)
        );

        const isEligibleForRefund = daysSincePayment <= 5;


        if (request_refund && !isEligibleForRefund) {
            return res.status(400).json({
                success: false,
                message: 'Refund is only available within 5 days of payment',
                days_since_payment: daysSincePayment,
                refund_deadline: new Date(subscription.paid_at.getTime() + 5 * 24 * 60 * 60 * 1000)
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }


        if (request_refund && isEligibleForRefund) {

            const refundResult = await duitkuService.requestRefund({
                reference: subscription.duitku_reference,
                amount: subscription.amount,
                reason: cancellation_reason || 'User requested cancellation'
            });

            if (refundResult.success) {

                user.role = 'verified';
                await user.save();


                subscription.status = 'refunded';
                subscription.cancellation_reason = cancellation_reason;
                subscription.cancelled_at = new Date();
                subscription.cancelled_by = 'user';
                subscription.refund_reference = refundResult.data.refundReference;
                subscription.refunded_at = new Date();
                subscription.refund_amount = subscription.amount;
                subscription.refund_status = 'processed';
                subscription.auto_renewal_enabled = false;
                await subscription.save();


                await mailService.sendCancellationConfirmation(subscription, user, true);

                return res.status(200).json({
                    success: true,
                    message: 'Subscription cancelled and refund processed',
                    refund_amount: subscription.amount,
                    refund_reference: refundResult.data.refundReference,
                    status: 'refunded'
                });
            } else {

                return res.status(500).json({
                    success: false,
                    message: 'Failed to process refund. Please contact support.',
                    error: refundResult.message
                });
            }
        }


        subscription.auto_renewal_enabled = false;
        subscription.cancellation_reason = cancellation_reason;
        subscription.cancelled_at = new Date();
        subscription.cancelled_by = 'user';
        subscription.status = 'cancelled';
        await subscription.save();


        await mailService.sendCancellationConfirmation(subscription, user, false);

        return res.status(200).json({
            success: true,
            message: 'Subscription cancelled. Access continues until ' +
                subscription.subscription_end_date.toDateString(),
            access_until: subscription.subscription_end_date,
            status: 'cancelled'
        });

    } catch (error) {
        console.error('❌ Cancel subscription error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: error.message
        });
    }
});

module.exports = router;
