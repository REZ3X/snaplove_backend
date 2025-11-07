const express = require('express');
const router = express.Router();
const User = require('../../../models/User');
const Subscription = require('../../../models/Subscription');
const duitkuService = require('../../../services/duitkuService');
const { auth } = require('../../../middleware/middleware');

router.post('/', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const { paymentMethod } = req.body;

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Payment method is required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role === 'verified_premium') {
            return res.status(400).json({
                success: false,
                message: 'You already have premium subscription'
            });
        }

        const pendingSubscription = await Subscription.findOne({
            user: userId,
            status: 'pending',
            expires_at: { $gt: new Date() }
        });

        if (pendingSubscription) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending payment',
                data: {
                    order_id: pendingSubscription.order_id,
                    payment_url: pendingSubscription.payment_url,
                    expires_at: pendingSubscription.expires_at
                }
            });
        }

        const orderId = `SUB-${userId}-${Date.now()}`;
        const amount = 45000;         const expiryPeriod = 1440; 
        const customerDetail = {
            firstName: user.name.split(' ')[0] || user.name,
            lastName: user.name.split(' ').slice(1).join(' ') || user.username,
            email: user.email,
            phoneNumber: req.body.phoneNumber || '-',
            billingAddress: {
                firstName: user.name.split(' ')[0] || user.name,
                lastName: user.name.split(' ').slice(1).join(' ') || user.username,
                address: req.body.address || 'Indonesia',
                city: req.body.city || 'Jakarta',
                postalCode: req.body.postalCode || '10000',
                phone: req.body.phoneNumber || '-',
                countryCode: 'ID'
            },
            shippingAddress: {
                firstName: user.name.split(' ')[0] || user.name,
                lastName: user.name.split(' ').slice(1).join(' ') || user.username,
                address: req.body.address || 'Indonesia',
                city: req.body.city || 'Jakarta',
                postalCode: req.body.postalCode || '10000',
                phone: req.body.phoneNumber || '-',
                countryCode: 'ID'
            }
        };

        const transaction = await duitkuService.createTransaction({
            merchantOrderId: orderId,
            paymentAmount: amount,
            paymentMethod,
            customerDetail,
            callbackUrl: `${process.env.BASE_URL}/api/subscription/callback`,
            returnUrl: `${process.env.FRONTEND_URL}/subscription/payment/status`,
            expiryPeriod
        });

        if (!transaction.success) {
            return res.status(400).json({
                success: false,
                message: transaction.message
            });
        }

        const subscription = new Subscription({
            user: userId,
            order_id: orderId,
            duitku_reference: transaction.data.reference,
            payment_method: paymentMethod,
            amount,
            status: 'pending',
            payment_url: transaction.data.paymentUrl,
            va_number: transaction.data.vaNumber,
            qr_string: transaction.data.qrString,
            expires_at: new Date(Date.now() + expiryPeriod * 60 * 1000),
            metadata: {
                customer_name: user.name,
                customer_email: user.email,
                customer_username: user.username
            }
        });

        await subscription.save();

        return res.status(201).json({
            success: true,
            message: 'Payment created successfully',
            data: {
                order_id: subscription.order_id,
                reference: subscription.duitku_reference,
                payment_url: subscription.payment_url,
                va_number: subscription.va_number,
                qr_string: subscription.qr_string,
                amount: subscription.amount,
                expires_at: subscription.expires_at,
                payment_method: paymentMethod
            }
        });

    } catch (error) {
        console.error('Create Payment Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
