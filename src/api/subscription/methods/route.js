const express = require('express');
const router = express.Router();
const duitkuService = require('../../../services/duitkuService');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');

router.get('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const amount = 45000; 

        const result = await duitkuService.getPaymentMethods(amount);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        const formattedMethods = result.data.map(method => ({
            code: method.paymentMethod,
            name: method.paymentName,
            image: method.paymentImage,
            fee: parseInt(method.totalFee) || 0,
            total_amount: amount + (parseInt(method.totalFee) || 0)
        }));

        const grouped = {
            virtual_account: [],
            e_wallet: [],
            retail: [],
            qris: [],
            credit_card: [],
            paylater: [],
            other: []
        };

        formattedMethods.forEach(method => {
            const code = method.code;

            if (['BC', 'M2', 'VA', 'I1', 'B1', 'BT', 'A1', 'AG', 'NC', 'BR', 'S1', 'DM', 'BV'].includes(code)) {
                grouped.virtual_account.push(method);
            } else if (['OV', 'SA', 'LF', 'LA', 'DA', 'SL', 'OL'].includes(code)) {
                grouped.e_wallet.push(method);
            } else if (['FT', 'IR'].includes(code)) {
                grouped.retail.push(method);
            } else if (['SP', 'NQ', 'GQ', 'SQ'].includes(code)) {
                grouped.qris.push(method);
            } else if (code === 'VC') {
                grouped.credit_card.push(method);
            } else if (['DN', 'AT'].includes(code)) {
                grouped.paylater.push(method);
            } else {
                grouped.other.push(method);
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                amount,
                methods: formattedMethods,
                grouped
            }
        });

    } catch (error) {
        console.error('Get Payment Methods Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
