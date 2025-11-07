const express = require('express');
const router = express.Router();
const User = require('../../../models/User');
const Subscription = require('../../../models/Subscription');
const { auth } = require('../../../middleware/middleware');

router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role !== 'verified_premium') {
            return res.status(200).json({
                success: true,
                data: {
                    has_subscription: false,
                    role: user.role
                }
            });
        }

        const subscription = await Subscription.findOne({
            user: userId,
            status: 'success'
        }).sort({ paid_at: -1 });

        if (!subscription) {
            return res.status(200).json({
                success: true,
                data: {
                    has_subscription: false,
                    role: user.role
                }
            });
        }

        const now = new Date();
        const isActive = subscription.subscription_end_date && subscription.subscription_end_date > now;

        if (!isActive && subscription.subscription_end_date) {
            user.role = 'verified_basic';
            await user.save();

            return res.status(200).json({
                success: true,
                data: {
                    has_subscription: false,
                    expired: true,
                    expired_at: subscription.subscription_end_date,
                    role: user.role
                }
            });
        }

        const remainingDays = Math.ceil(
            (subscription.subscription_end_date - now) / (1000 * 60 * 60 * 24)
        );

        return res.status(200).json({
            success: true,
            data: {
                has_subscription: true,
                subscription: {
                    order_id: subscription.order_id,
                    started_at: subscription.subscription_start_date,
                    expires_at: subscription.subscription_end_date,
                    remaining_days: remainingDays,
                    payment_method: subscription.payment_method,
                    amount: subscription.amount
                },
                role: user.role
            }
        });

    } catch (error) {
        console.error('Get Current Subscription Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
