const express = require('express');
const { authenticateToken, checkBanStatus, requireRole } = require('../../../middleware/middleware');
const Maintenance = require('../../../models/Maintenance');

const router = express.Router();

router.get('/', authenticateToken, checkBanStatus, requireRole(['official', 'developer']), async (req, res) => {
    try {
        const maintenance = await Maintenance.getSetting();

        res.json({
            success: true,
            data: {
                isActive: maintenance.isActive,
                estimatedEndTime: maintenance.estimatedEndTime,
                message: maintenance.message,
                updatedAt: maintenance.updatedAt
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

router.put('/', authenticateToken, checkBanStatus, requireRole(['official', 'developer']), async (req, res) => {
    try {
        const { isActive, estimatedEndTime, message } = req.body;

        const updateData = {};

        if (typeof isActive === 'boolean') {
            updateData.isActive = isActive;
        }

        if (estimatedEndTime !== undefined) {
            updateData.estimatedEndTime = estimatedEndTime ? new Date(estimatedEndTime) : null;
        }

        if (message !== undefined) {
            updateData.message = message || 'We are currently performing scheduled maintenance. Please check back soon!';
        }

        const maintenance = await Maintenance.updateSetting(updateData, req.user._id);

        res.json({
            success: true,
            message: 'Maintenance mode updated successfully',
            data: {
                isActive: maintenance.isActive,
                estimatedEndTime: maintenance.estimatedEndTime,
                message: maintenance.message,
                updatedAt: maintenance.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating maintenance mode:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update maintenance mode'
        });
    }
});

module.exports = router;
