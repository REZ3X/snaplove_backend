const express = require('express');
const router = express.Router();
const Subscription = require('../../../models/Subscription');
const { authenticateToken, checkBanStatus } = require('../../../middleware/middleware');

router.get('/', authenticateToken, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 10, status } = req.query;

        const query = { user: userId };

        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const subscriptions = await Subscription.find(query)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await Subscription.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: {
                subscriptions,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(total / parseInt(limit)),
                    total_items: total,
                    items_per_page: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get Subscription History Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
