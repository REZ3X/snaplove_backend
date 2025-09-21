const express = require('express');
const { query, validationResult } = require('express-validator');
const Frame = require('../../models/Frame');
const User = require('../../models/User');
const { getDisplayProfileImage } = require('../../utils/profileImageHelper');

const router = express.Router();

router.get('/', [
    query('q').notEmpty().withMessage('Search query is required'),
    query('type').optional().isIn(['frames', 'users', 'all']).withMessage('Type must be frames, users, or all'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),

    query('layout_type').optional().isIn(['2x1', '3x1', '4x1']).withMessage('Invalid layout type'),
    query('tag').optional().isString().withMessage('Tag must be a string'),
    query('approval_status').optional().isIn(['approved', 'pending', 'rejected']).withMessage('Invalid approval status'),
    query('official_only').optional().isBoolean().withMessage('Official only must be boolean'),
    query('sort_frames').optional().isIn(['relevance', 'newest', 'oldest', 'most_liked', 'most_used']).withMessage('Invalid frame sort option'),

    query('role').optional().isIn(['basic', 'verified_basic', 'verified_premium', 'official', 'developer']).withMessage('Invalid role'),
    query('sort_users').optional().isIn(['relevance', 'newest', 'oldest', 'name_asc', 'name_desc']).withMessage('Invalid user sort option')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const searchQuery = req.query.q.trim();
        const searchType = req.query.type || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const searchRegex = new RegExp(searchQuery.split(' ').map(word =>
            word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ).join('|'), 'i');

        const results = {
            query: searchQuery,
            type: searchType
        };

        if (searchType === 'frames' || searchType === 'all') {
            const frameFilter = {
                visibility: 'public',
                approval_status: 'approved',
                $or: [
                    { title: { $regex: searchRegex } },
                    { desc: { $regex: searchRegex } },
                    { tag_label: { $in: [searchRegex] } }
                ]
            };

            if (req.query.layout_type) {
                frameFilter.layout_type = req.query.layout_type;
            }

            if (req.query.tag) {
                frameFilter.tag_label = { $in: [new RegExp(req.query.tag, 'i')] };
            }

            if (req.query.approval_status) {
                frameFilter.approval_status = req.query.approval_status;
            }

            if (req.query.official_only === 'true') {
                frameFilter.official_status = true;
            }

            let frameSort = {};
            switch (req.query.sort_frames) {
                case 'newest':
                    frameSort = { created_at: -1 };
                    break;
                case 'oldest':
                    frameSort = { created_at: 1 };
                    break;
                case 'most_liked':
                    frameSort = { 'like_count': -1, created_at: -1 };
                    break;
                case 'most_used':
                    frameSort = { 'use_count': -1, created_at: -1 };
                    break;
                case 'relevance':
                default:
                    frameSort = {
                        title_relevance: -1,
                        total_interactions: -1,
                        created_at: -1
                    };
                    break;
            }

            const frameAggregation = [
                { $match: frameFilter },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $match: {
                        'user.ban_status': false
                    }
                },
                {
                    $addFields: {
                        total_interactions: {
                            $add: [
                                { $size: { $ifNull: ['$like_count', []] } },
                                { $size: { $ifNull: ['$use_count', []] } }
                            ]
                        },
                        title_relevance: {
                            $cond: [
                                { $regexMatch: { input: { $ifNull: ['$title', ''] }, regex: searchRegex } },
                                10,
                                {
                                    $cond: [
                                        { $regexMatch: { input: { $ifNull: ['$desc', ''] }, regex: searchRegex } },
                                        5,
                                        1
                                    ]
                                }
                            ]
                        }
                    }
                },
                { $sort: frameSort },
                { $skip: searchType === 'all' ? 0 : skip },
                { $limit: searchType === 'all' ? 10 : limit }
            ];

            const frames = await Frame.aggregate(frameAggregation);

            const frameTotalPipeline = [
                { $match: frameFilter },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $match: {
                        'user.ban_status': false
                    }
                },
                { $count: 'total' }
            ];

            const frameCountResult = await Frame.aggregate(frameTotalPipeline);
            const frameTotal = frameCountResult[0]?.total || 0;

            results.frames = {
                data: frames.map(frame => {
                    const desc = frame.desc || '';
                    const truncatedDesc = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;

                    return {
                        id: frame._id,
                        images: Array.isArray(frame.images) ? frame.images.map(img => req.protocol + '://' + req.get('host') + '/' + img) : [],
                        thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
                        title: frame.title || 'Untitled Frame',
                        desc: truncatedDesc,
                        total_likes: frame.total_likes || (Array.isArray(frame.like_count) ? frame.like_count.length : 0),
                        total_uses: frame.total_uses || (Array.isArray(frame.use_count) ? frame.use_count.length : 0),
                        layout_type: frame.layout_type || '2x1',
                        official_status: frame.official_status || false,
                        approval_status: frame.approval_status || 'pending',
                        tag_label: Array.isArray(frame.tag_label) ? frame.tag_label : [],
                        relevance_score: frame.title_relevance || 0,
                        user: {
                            id: frame.user._id,
                            name: frame.user.name || 'Unknown User',
                            username: frame.user.username,
                            image_profile: getDisplayProfileImage(frame.user, req),
                            role: frame.user.role || 'basic'
                        },
                        created_at: frame.created_at,
                        updated_at: frame.updated_at
                    };
                }),
                pagination: searchType === 'frames' ? {
                    current_page: page,
                    total_pages: Math.ceil(frameTotal / limit),
                    total_items: frameTotal,
                    items_per_page: limit,
                    has_next_page: page < Math.ceil(frameTotal / limit),
                    has_prev_page: page > 1
                } : {
                    showing: Math.min(10, frames.length),
                    total_found: frameTotal
                }
            };
        }

        if (searchType === 'users' || searchType === 'all') {
            const userFilter = {
                ban_status: false,
                $or: [
                    { name: { $regex: searchRegex } },
                    { username: { $regex: searchRegex } },
                    { bio: { $regex: searchRegex } }
                ]
            };

            if (req.query.role) {
                userFilter.role = req.query.role;
            }

            let userSort = {};
            switch (req.query.sort_users) {
                case 'newest':
                    userSort = { created_at: -1 };
                    break;
                case 'oldest':
                    userSort = { created_at: 1 };
                    break;
                case 'name_asc':
                    userSort = { name: 1 };
                    break;
                case 'name_desc':
                    userSort = { name: -1 };
                    break;
                case 'relevance':
                default:
                    userSort = {
                        username_relevance: -1,
                        name_relevance: -1,
                        created_at: -1
                    };
                    break;
            }

            const userAggregation = [
                { $match: userFilter },
                {
                    $addFields: {
                        username_relevance: {
                            $cond: [
                                { $regexMatch: { input: { $ifNull: ['$username', ''] }, regex: searchRegex } },
                                10,
                                0
                            ]
                        },
                        name_relevance: {
                            $cond: [
                                { $regexMatch: { input: { $ifNull: ['$name', ''] }, regex: searchRegex } },
                                8,
                                {
                                    $cond: [
                                        { $regexMatch: { input: { $ifNull: ['$bio', ''] }, regex: searchRegex } },
                                        3,
                                        0
                                    ]
                                }
                            ]
                        }
                    }
                },
                { $sort: userSort },
                { $skip: searchType === 'all' ? 0 : skip },
                { $limit: searchType === 'all' ? 10 : limit }
            ];

            const users = await User.aggregate(userAggregation);

            const userTotal = await User.countDocuments(userFilter);

            results.users = {
                data: users.map(user => ({
                    id: user._id,
                    name: user.name || 'Unknown User',
                    username: user.username,
                    image_profile: getDisplayProfileImage(user, req),
                    role: user.role || 'basic',
                    bio: user.bio && user.bio.length > 100 ? user.bio.substring(0, 100) + '...' : (user.bio || ''),
                    relevance_score: (user.username_relevance || 0) + (user.name_relevance || 0),
                    created_at: user.created_at,
                    updated_at: user.updated_at
                })),
                pagination: searchType === 'users' ? {
                    current_page: page,
                    total_pages: Math.ceil(userTotal / limit),
                    total_items: userTotal,
                    items_per_page: limit,
                    has_next_page: page < Math.ceil(userTotal / limit),
                    has_prev_page: page > 1
                } : {
                    showing: Math.min(10, users.length),
                    total_found: userTotal
                }
            };
        }

        const suggestions = await generateSearchSuggestions(searchQuery, searchType);
        results.suggestions = suggestions;

        results.statistics = {
            total_results: (results.frames?.pagination?.total_items || 0) + (results.users?.pagination?.total_items || 0),
            search_time_ms: Date.now() - Date.now(),
            filters_applied: {
                layout_type: req.query.layout_type || null,
                tag: req.query.tag || null,
                approval_status: req.query.approval_status || null,
                official_only: req.query.official_only === 'true',
                role: req.query.role || null
            }
        };

        res.json({
            success: true,
            message: `Search completed for "${searchQuery}"`,
            data: results
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

async function generateSearchSuggestions(query, type) {
    try {
        const suggestions = [];

        if (type === 'frames' || type === 'all') {
            const tagSuggestions = await Frame.aggregate([
                {
                    $match: {
                        visibility: 'public',
                        approval_status: 'approved',
                        tag_label: { $regex: new RegExp(query, 'i') }
                    }
                },
                { $unwind: '$tag_label' },
                {
                    $match: {
                        tag_label: { $regex: new RegExp(query, 'i') }
                    }
                },
                {
                    $group: {
                        _id: '$tag_label',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            suggestions.push(...tagSuggestions.map(tag => ({
                type: 'tag',
                text: tag._id,
                count: tag.count
            })));
        }

        if (type === 'users' || type === 'all') {
            const userSuggestions = await User.aggregate([
                {
                    $match: {
                        ban_status: false,
                        $or: [
                            { username: { $regex: new RegExp(query, 'i') } },
                            { name: { $regex: new RegExp(query, 'i') } }
                        ]
                    }
                },
                {
                    $project: {
                        username: 1,
                        name: 1,
                        role: 1
                    }
                },
                { $limit: 3 }
            ]);

            suggestions.push(...userSuggestions.map(user => ({
                type: 'user',
                text: user.username,
                display_name: user.name,
                role: user.role
            })));
        }

        return suggestions.slice(0, 8);
    } catch (error) {
        console.error('Error generating suggestions:', error);
        return [];
    }
}

module.exports = router;