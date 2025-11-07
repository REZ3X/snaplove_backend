const express = require('express');
const router = express.Router();
const User = require('../../../models/User');
const Subscription = require('../../../models/Subscription');
const duitkuService = require('../../../services/duitkuService');
const { sendNotificationToUser } = require('../../../services/socketService');

router.post('/', async (req, res) => {
    try {
        console.log('Duitku Callback Received:', req.body);

        const result = duitkuService.processCallback(req.body);

        if (!result.success) {
            console.error('Invalid callback signature');
            return res.status(400).send('Bad Signature');
        }

        const {
            merchantOrderId,
            reference,
            _amount,
            paymentCode,
            status,
            publisherOrderId,
            settlementDate
        } = result.data;

        const subscription = await Subscription.findOne({ order_id: merchantOrderId });

        if (!subscription) {
            console.error('Subscription not found:', merchantOrderId);
            return res.status(404).send('Order not found');
        }

        subscription.status = status;
        subscription.payment_code = paymentCode;
        subscription.publisher_order_id = publisherOrderId;
        subscription.duitku_reference = reference;

        if (settlementDate) {
            subscription.settlement_date = new Date(settlementDate);
        }

        if (status === 'success') {
            subscription.paid_at = new Date();
            subscription.subscription_start_date = new Date();

            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);
            subscription.subscription_end_date = endDate;

            await subscription.save();

            const user = await User.findById(subscription.user);
            if (user) {
                user.role = 'verified_premium';
                await user.save();

                try {
                    await sendNotificationToUser(user._id.toString(), {
                        type: 'subscription_success',
                        title: '🎉 Premium Subscription Activated!',
                        message: 'Your premium subscription has been activated successfully. Enjoy all premium features!',
                        data: {
                            subscription_id: subscription._id,
                            expires_at: subscription.subscription_end_date
                        }
                    });
                } catch (notifError) {
                    console.error('Failed to send notification:', notifError);
                }
            }

            console.log(`Subscription ${merchantOrderId} activated successfully for user ${subscription.user}`);
        } else if (status === 'failed') {
            await subscription.save();
            console.log(`Subscription ${merchantOrderId} payment failed`);
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Callback Processing Error:', error);
        return res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
