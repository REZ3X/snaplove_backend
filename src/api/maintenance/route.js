const express = require('express');
const Maintenance = require('../../models/Maintenance');

const router = express.Router();

router.get('/status', async (req, res) => {
    try {
        const maintenance = await Maintenance.getSetting();

        res.json({
            success: true,
            data: {
                isActive: maintenance.isActive,
                estimatedEndTime: maintenance.estimatedEndTime,
                message: maintenance.message
            }
        });
    } catch (error) {
        console.error('Error fetching maintenance status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch maintenance status'
        });
    }
});

module.exports = router;
