const express = require('express');
const { param, body, validationResult } = require('express-validator');
const Report = require('../../../../models/Report');
const Frame = require('../../../../models/Frame');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../middleware');

const router = express.Router();


router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid report ID')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const report = await Report.findById(req.params.id)
            .populate('user_id', 'name username image_profile role email')
            .populate('frame_id', 'title images layout_type user_id visibility', null, { populate: { path: 'user_id', select: 'name username email' } })
            .populate('admin_id', 'name username role');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        res.json({
            success: true,
            data: {
                report: {
                    id: report._id,
                    title: report.title,
                    description: report.description,
                    report_status: report.report_status,
                    admin_response: report.admin_response,
                    reporter: {
                        id: report.user_id._id,
                        name: report.user_id.name,
                        username: report.user_id.username,
                        email: report.user_id.email,
                        image_profile: report.user_id.image_profile,
                        role: report.user_id.role
                    },
                    frame: report.frame_id ? {
                        id: report.frame_id._id,
                        title: report.frame_id.title,
                        images: report.frame_id.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
                        layout_type: report.frame_id.layout_type,
                        visibility: report.frame_id.visibility,
                        owner: report.frame_id.user_id ? {
                            id: report.frame_id.user_id._id,
                            name: report.frame_id.user_id.name,
                            username: report.frame_id.user_id.username,
                            email: report.frame_id.user_id.email
                        } : null
                    } : {
                        id: null,
                        title: 'Frame Deleted',
                        images: [],
                        layout_type: null,
                        visibility: null,
                        owner: null
                    },
                    admin: report.admin_id ? {
                        id: report.admin_id._id,
                        name: report.admin_id.name,
                        username: report.admin_id.username,
                        role: report.admin_id.role
                    } : null,
                    created_at: report.created_at,
                    updated_at: report.updated_at
                }
            }
        });

    } catch (error) {
        console.error('Admin get report detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


router.put('/:id', [
    param('id').isMongoId().withMessage('Invalid report ID'),
    body('report_status').optional().isIn(['pending', 'done', 'rejected']).withMessage('Invalid status'),
    body('admin_response').optional().isLength({ min: 1, max: 1000 }).withMessage('Admin response must be 1-1000 characters'),
    body('action').optional().isIn(['delete_frame', 'no_action']).withMessage('Invalid action')
], authenticateToken, checkBanStatus, requireAdmin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        const { report_status, admin_response, action } = req.body;
        const updateData = {};
        const changes = [];

        if (report_status !== undefined && report_status !== report.report_status) {
            updateData.report_status = report_status;
            changes.push(`Status changed from ${report.report_status} to ${report_status}`);
        }

        if (admin_response !== undefined) {
            updateData.admin_response = admin_response.trim();
            updateData.admin_id = req.user.userId;
            changes.push('Admin response added/updated');
        }


        if (action === 'delete_frame' && report.frame_id) {
            try {
                const frame = await Frame.findById(report.frame_id);
                if (frame) {

                    const imageHandler = require('../../../../utils/LocalImageHandler');
                    const imageDeletePromises = frame.images.map(async (imagePath) => {
                        try {
                            await imageHandler.deleteImage(imagePath);
                        } catch (error) {
                            console.error(`Failed to delete image ${imagePath}:`, error);
                        }
                    });
                    await Promise.allSettled(imageDeletePromises);


                    await Frame.findByIdAndDelete(frame._id);
                    changes.push('Reported frame deleted');


                    updateData.report_status = 'done';
                    if (!updateData.admin_response) {
                        updateData.admin_response = 'Frame deleted due to inappropriate content.';
                        updateData.admin_id = req.user.userId;
                    }

                    console.log(`ADMIN ACTION: Admin ${req.user.userId} deleted frame ${frame._id} due to report ${report._id}`);
                }
            } catch (error) {
                console.error('Error deleting reported frame:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to delete frame'
                });
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No changes detected'
            });
        }

        const updatedReport = await Report.findByIdAndUpdate(
            report._id,
            updateData,
            { new: true }
        )
            .populate('user_id', 'name username image_profile role email')
            .populate('frame_id', 'title images layout_type user_id', null, { populate: { path: 'user_id', select: 'name username' } })
            .populate('admin_id', 'name username role');

        console.log(`ADMIN UPDATE: Admin ${req.user.userId} updated report ${report._id}. Changes: ${changes.join(', ')}`);

        res.json({
            success: true,
            message: 'Report updated successfully',
            data: {
                report: {
                    id: updatedReport._id,
                    title: updatedReport.title,
                    description: updatedReport.description,
                    report_status: updatedReport.report_status,
                    admin_response: updatedReport.admin_response,
                    reporter: {
                        id: updatedReport.user_id._id,
                        name: updatedReport.user_id.name,
                        username: updatedReport.user_id.username,
                        email: updatedReport.user_id.email,
                        image_profile: updatedReport.user_id.image_profile,
                        role: updatedReport.user_id.role
                    },
                    frame: updatedReport.frame_id ? {
                        id: updatedReport.frame_id._id,
                        title: updatedReport.frame_id.title,
                        images: updatedReport.frame_id.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
                        layout_type: updatedReport.frame_id.layout_type,
                        owner: updatedReport.frame_id.user_id ? {
                            id: updatedReport.frame_id.user_id._id,
                            name: updatedReport.frame_id.user_id.name,
                            username: updatedReport.frame_id.user_id.username
                        } : null
                    } : null,
                    admin: updatedReport.admin_id ? {
                        id: updatedReport.admin_id._id,
                        name: updatedReport.admin_id.name,
                        username: updatedReport.admin_id.username,
                        role: updatedReport.admin_id.role
                    } : null,
                    created_at: updatedReport.created_at,
                    updated_at: updatedReport.updated_at
                },
                changes,
                admin_action: {
                    admin_id: req.user.userId,
                    action: 'UPDATE_REPORT',
                    timestamp: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('Admin update report error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;