const express = require('express');
const router = express.Router();
const Subscription = require('../../../models/Subscription');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');

/**
 * Get subscription details with refund eligibility
 * GET /api/subscription/details
 */
router.get('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.userId;


        const subscription = await Subscription.findOne({
            user: userId,
            status: { $in: ['success', 'cancelled', 'grace_period', 'refunded'] }
        }).sort({ created_at: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No subscription found',
                data: null
            });
        }

        const now = new Date();


        let daysSincePayment = 0;
        let daysUntilRefundDeadline = 0;
        let canRefund = false;

        if (subscription.paid_at) {
            daysSincePayment = Math.floor(
                (now.getTime() - subscription.paid_at.getTime()) / (1000 * 60 * 60 * 24)
            );
            daysUntilRefundDeadline = 5 - daysSincePayment;
            canRefund = daysSincePayment <= 5 &&
                subscription.status !== 'refunded' &&
                subscription.status !== 'grace_period';
        }


        let daysUntilRenewal = 0;
        if (subscription.subscription_end_date) {
            daysUntilRenewal = Math.ceil(
                (subscription.subscription_end_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
        }


        let gracePeriodDaysRemaining = 0;
        if (subscription.status === 'grace_period' && subscription.grace_period_end) {
            gracePeriodDaysRemaining = Math.ceil(
                (subscription.grace_period_end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
        }


        const canCancel = subscription.status === 'success' || subscription.status === 'cancelled';


        const paymentMethodMap = {
            'SP': 'ShopeePay',
            'DA': 'DANA',
            'OV': 'OVO',
            'BC': 'BCA Virtual Account',
            'M2': 'Mandiri Virtual Account',
            'BN': 'BNI Virtual Account',
            'BR': 'BRI Virtual Account',
            'AG': 'Bank Transfer',
            'VA': 'Virtual Account',
            'FT': 'Retail Store',
            'I1': 'BCA KlikPay',
            'CC': 'Credit Card',
            'SA': 'Shopee Pay Apps',
            'LF': 'LinkAja Fixed Fee',
            'LA': 'LinkAja',
            'A1': 'A1 Payment',
            'NC': 'NFC',
            'QR': 'QRIS'
        };

        const paymentMethodDisplay = paymentMethodMap[subscription.payment_method] || subscription.payment_method || 'Unknown';


        const details = {
            order_id: subscription.order_id,
            status: subscription.status,
            amount: subscription.amount,
            payment_method: paymentMethodDisplay,
            payment_method_code: subscription.payment_method,


            paid_at: subscription.paid_at,
            subscription_start_date: subscription.subscription_start_date,
            subscription_end_date: subscription.subscription_end_date,
            next_billing_date: subscription.subscription_end_date,
            cancelled_at: subscription.cancelled_at,
            refunded_at: subscription.refunded_at,


            auto_renewal_enabled: subscription.auto_renewal_enabled,
            days_until_renewal: daysUntilRenewal,


            can_cancel: canCancel,
            cancellation_reason: subscription.cancellation_reason,


            can_refund: canRefund,
            days_since_payment: daysSincePayment,
            days_until_refund_deadline: daysUntilRefundDeadline,
            refund_deadline: subscription.paid_at ?
                new Date(subscription.paid_at.getTime() + 5 * 24 * 60 * 60 * 1000) : null,
            refund_amount: subscription.refund_amount,
            refund_reference: subscription.refund_reference,
            refund_status: subscription.refund_status,


            grace_period_start: subscription.grace_period_start,
            grace_period_end: subscription.grace_period_end,
            grace_period_days_remaining: gracePeriodDaysRemaining,


            renewal_attempt_count: subscription.renewal_attempt_count || 0,
            last_renewal_attempt: subscription.last_renewal_attempt,


            created_at: subscription.created_at,
            updated_at: subscription.updated_at
        };

        return res.status(200).json({
            success: true,
            data: details
        });

    } catch (error) {
        console.error('❌ Get subscription details error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get subscription details',
            error: error.message
        });
    }
});

module.exports = router;
