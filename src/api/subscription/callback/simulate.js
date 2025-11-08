const express = require('express');
const router = express.Router();
const Subscription = require('../../../models/Subscription');
const duitkuService = require('../../../services/duitkuService');

/**
 * TEST ONLY: Simulate Duitku callback for sandbox testing
 * This endpoint should be removed in production
 */
router.post('/simulate', async (req, res) => {
    try {

        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                message: 'This endpoint is only available in development mode'
            });
        }

        const { merchantOrderId } = req.body;

        if (!merchantOrderId) {
            return res.status(400).json({
                success: false,
                message: 'merchantOrderId is required'
            });
        }

        const subscription = await Subscription.findOne({ order_id: merchantOrderId });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        const callbackData = {
            merchantCode: process.env.DUITKU_MERCHANT_CODE,
            amount: subscription.amount.toString(),
            merchantOrderId,
            productDetail: 'Snaplove Premium Subscription - 1 Month',
            additionalParam: '',
            paymentCode: subscription.payment_method,
            resultCode: '00',
            merchantUserId: subscription.user.toString(),
            reference: subscription.duitku_reference,
            signature: ''         };

        const signature = require('crypto')
            .createHash('md5')
            .update(`${process.env.DUITKU_MERCHANT_CODE}${callbackData.amount}${merchantOrderId}${process.env.DUITKU_API_KEY}`)
            .digest('hex');

        callbackData.signature = signature;

        console.log('Simulating callback for:', merchantOrderId);

        const result = duitkuService.processCallback(callbackData);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid callback signature'
            });
        }

        subscription.status = 'success';
        subscription.paid_at = new Date();
        subscription.subscription_start_date = new Date();

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        subscription.subscription_end_date = endDate;

        await subscription.save();

        const User = require('../../../models/User');
        const user = await User.findById(subscription.user);
        if (user) {
            user.role = 'verified_premium';
            await user.save();
        }

        console.log(`✅ Subscription ${merchantOrderId} activated successfully`);

        return res.status(200).json({
            success: true,
            message: 'Subscription activated successfully',
            data: {
                order_id: subscription.order_id,
                status: subscription.status,
                subscription_start_date: subscription.subscription_start_date,
                subscription_end_date: subscription.subscription_end_date
            }
        });

    } catch (error) {
        console.error('Simulate Callback Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
