const express = require('express');
const { query, validationResult } = require('express-validator');
const Report = require('../../../models/Report');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../middleware/middleware');

const router = express.Router();

router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'done', 'rejected']).withMessage('Invalid status'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('sort').optional().isIn(['newest', 'oldest', 'title_asc', 'title_desc']).withMessage('Invalid sort option')
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

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};

        if (req.query.status) {
            filter.report_status = req.query.status;
        }

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            filter.$or = [
                { title: searchRegex },
                { description: searchRegex }
            ];
        }

        let sort = {};
        switch (req.query.sort) {
            case 'oldest':
                sort = { created_at: 1 };
                break;
            case 'title_asc':
                sort = { title: 1 };
                break;
            case 'title_desc':
                sort = { title: -1 };
                break;
            default:
                sort = { created_at: -1 };
        }

        const reports = await Report.find(filter)
            .populate('user_id', 'name username image_profile role')
            .populate('frame_id', 'title images layout_type user_id', null, { populate: { path: 'user_id', select: 'name username' } })
            .populate('admin_id', 'name username role')
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await Report.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);


        const stats = await Report.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$report_status', 'pending'] }, 1, 0] } },
                    done: { $sum: { $cond: [{ $eq: ['$report_status', 'done'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$report_status', 'rejected'] }, 1, 0] } }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                reports: reports.map(report => ({
                    id: report._id,
                    title: report.title,
                    description: report.description.length > 150
                        ? report.description.substring(0, 150) + '...'
                        : report.description,
                    report_status: report.report_status,
                    admin_response: report.admin_response,
                    reporter: {
                        id: report.user_id._id,
                        name: report.user_id.name,
                        username: report.user_id.username,
                        image_profile: report.user_id.image_profile,
                        role: report.user_id.role
                    },
                    frame: report.frame_id ? {
                        id: report.frame_id._id,
                        title: report.frame_id.title,
                        images: report.frame_id.images?.map(img => req.protocol + '://' + req.get('host') + '/' + img) || [],
                        layout_type: report.frame_id.layout_type,
                        owner: report.frame_id.user_id ? {
                            id: report.frame_id.user_id._id,
                            name: report.frame_id.user_id.name,
                            username: report.frame_id.user_id.username
                        } : null
                    } : {
                        id: null,
                        title: 'Frame Deleted',
                        images: [],
                        layout_type: null,
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
                })),
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_items: total,
                    items_per_page: limit,
                    has_next_page: page < totalPages,
                    has_prev_page: page > 1
                },
                statistics: stats[0] || {
                    total: 0,
                    pending: 0,
                    done: 0,
                    rejected: 0
                }
            }
        });

    } catch (error) {
        console.error('Admin get reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;