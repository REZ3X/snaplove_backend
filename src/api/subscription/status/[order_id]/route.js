const express = require('express');
const router = express.Router();
const Subscription = require('../../../../models/Subscription');
const duitkuService = require('../../../../services/duitkuService');
const { authenticateToken, checkBanStatus } = require('../../../../middleware/middleware');

router.get('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const { order_id } = req.params;
        const userId = req.user.userId;

        const subscription = await Subscription.findOne({
            order_id,
            user: userId
        });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        if (subscription.status === 'pending' && subscription.expires_at > new Date()) {
            const statusCheck = await duitkuService.checkTransactionStatus(order_id);

            if (statusCheck.success) {
                const duitkuStatus = statusCheck.data.statusCode;

                if (duitkuStatus === '00' && subscription.status !== 'success') {
                    subscription.status = 'success';
                    subscription.paid_at = new Date();
                    subscription.subscription_start_date = new Date();

                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + 30);
                    subscription.subscription_end_date = endDate;

                    await subscription.save();

                    const User = require('../../../../models/User');
                    await User.findByIdAndUpdate(userId, { role: 'verified_premium' });
                } else if (duitkuStatus === '02') {
                    subscription.status = 'failed';
                    await subscription.save();
                }
            }
        }

        if (subscription.status === 'pending' && subscription.expires_at <= new Date()) {
            subscription.status = 'expired';
            await subscription.save();
        }

        return res.status(200).json({
            success: true,
            data: {
                order_id: subscription.order_id,
                reference: subscription.duitku_reference,
                amount: subscription.amount,
                status: subscription.status,
                payment_method: subscription.payment_method,
                payment_code: subscription.payment_code,
                payment_url: subscription.payment_url,
                va_number: subscription.va_number,
                qr_string: subscription.qr_string,
                expires_at: subscription.expires_at,
                paid_at: subscription.paid_at,
                subscription_start_date: subscription.subscription_start_date,
                subscription_end_date: subscription.subscription_end_date,
                created_at: subscription.created_at
            }
        });

    } catch (error) {
        console.error('Get Subscription Status Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
