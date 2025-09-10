const express = require('express');
const { query, validationResult } = require('express-validator');
const Frame = require('../../../../models/Frame');
const { getDisplayProfileImage } = require('../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/trending', [
  query('type').optional().isIn(['uses', 'likes', 'both']).withMessage('Type must be uses, likes, or both'),
  query('period').optional().isIn(['1d', '3d', '7d', '1m', 'all']).withMessage('Period must be 1d, 3d, 7d, 1m, or all'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('layout_type').optional().isIn(['2x1', '3x1', '4x1']).withMessage('Invalid layout type'),
  query('official_only').optional().isBoolean().withMessage('Official only must be boolean')
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

    const type = req.query.type || 'both';
    const period = req.query.period || '7d';
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case '1d':
        dateFilter = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
        break;
      case '3d':
        dateFilter = { $gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) };
        break;
      case '7d':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '1m':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case 'all':
      default:
        dateFilter = null;
        break;
    }

    const baseFilter = {
      visibility: 'public',
      approval_status: 'approved'
    };

    if (req.query.layout_type) {
      baseFilter.layout_type = req.query.layout_type;
    }

    if (req.query.official_only === 'true') {
      baseFilter.official_status = true;
    }

    const results = {
      period: {
        type: period,
        description: getPeriodDescription(period),
        date_range: getDateRangeDescription(period, dateFilter)
      },
      filters: {
        layout_type: req.query.layout_type || null,
        official_only: req.query.official_only === 'true'
      }
    };

    if (type === 'uses' || type === 'both') {
      const usesAggregation = [
        { $match: baseFilter },
        { $unwind: '$use_count' },
        ...(dateFilter ? [{ $match: { 'use_count.created_at': dateFilter } }] : []),
        {
          $group: {
            _id: '$_id',
            frame_data: { $first: '$$ROOT' },
            period_uses: { $sum: 1 },
            unique_users: { $addToSet: '$use_count.user_id' },
            recent_uses: { $push: '$use_count.created_at' }
          }
        },
        {
          $addFields: {
            unique_users_count: { $size: '$unique_users' },
            usage_velocity: {
              $cond: [
                dateFilter,
                {
                  $divide: [
                    '$period_uses',
                    {
                      $max: [
                        1,
                        {
                          $divide: [
                            { $subtract: [new Date(), dateFilter.$gte] },
                            1000 * 60 * 60 * 24
                          ]
                        }
                      ]
                    }
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'frame_data.user_id',
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
          $sort: { 
            period_uses: -1, 
            unique_users_count: -1,
            usage_velocity: -1,
            'frame_data.created_at': -1 
          }
        },
        { $skip: type === 'both' ? 0 : skip },
        { $limit: type === 'both' ? Math.ceil(limit / 2) : limit }
      ];

      const mostUsedFrames = await Frame.aggregate(usesAggregation);

      const usesTotalPipeline = [
        { $match: baseFilter },
        { $unwind: '$use_count' },
        ...(dateFilter ? [{ $match: { 'use_count.created_at': dateFilter } }] : []),
        {
          $group: {
            _id: '$_id'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'frame'
          }
        },
        { $unwind: '$frame' },
        {
          $lookup: {
            from: 'users',
            localField: 'frame.user_id',
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

      const usesTotalResult = await Frame.aggregate(usesTotalPipeline);
      const usesTotal = usesTotalResult[0]?.total || 0;

      results.most_used = {
        data: mostUsedFrames.map((item, index) => ({
          rank: type === 'both' ? index + 1 : skip + index + 1,
          frame: {
            id: item.frame_data._id,
            images: item.frame_data.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            thumbnail: item.frame_data.thumbnail ? req.protocol + '://' + req.get('host') + '/' + item.frame_data.thumbnail : null,
            title: item.frame_data.title,
            desc: item.frame_data.desc.length > 150 ? item.frame_data.desc.substring(0, 150) + '...' : item.frame_data.desc,
            layout_type: item.frame_data.layout_type,
            official_status: item.frame_data.official_status,
            tag_label: item.frame_data.tag_label,
            total_likes: item.frame_data.like_count?.length || 0,
            total_uses: item.frame_data.use_count?.length || 0,
            created_at: item.frame_data.created_at,
            updated_at: item.frame_data.updated_at
          },
          user: {
            id: item.user._id,
            name: item.user.name,
            username: item.user.username,
            image_profile: getDisplayProfileImage(item.user, req),
            role: item.user.role
          },
          trending_stats: {
            period_uses: item.period_uses,
            unique_users_in_period: item.unique_users_count,
            usage_velocity_per_day: Math.round(item.usage_velocity * 100) / 100,
            trending_score: calculateTrendingScore(item.period_uses, item.unique_users_count, item.usage_velocity, 'uses')
          }
        })),
        pagination: type === 'uses' ? {
          current_page: page,
          total_pages: Math.ceil(usesTotal / limit),
          total_items: usesTotal,
          items_per_page: limit,
          has_next_page: page < Math.ceil(usesTotal / limit),
          has_prev_page: page > 1
        } : {
          showing: mostUsedFrames.length,
          total_found: usesTotal
        }
      };
    }

    if (type === 'likes' || type === 'both') {
      const likesAggregation = [
        { $match: baseFilter },
        { $unwind: '$like_count' },
        ...(dateFilter ? [{ $match: { 'like_count.created_at': dateFilter } }] : []),
        {
          $group: {
            _id: '$_id',
            frame_data: { $first: '$$ROOT' },
            period_likes: { $sum: 1 },
            unique_likers: { $addToSet: '$like_count.user_id' },
            recent_likes: { $push: '$like_count.created_at' }
          }
        },
        {
          $addFields: {
            unique_likers_count: { $size: '$unique_likers' },
            like_velocity: {
              $cond: [
                dateFilter,
                {
                  $divide: [
                    '$period_likes',
                    {
                      $max: [
                        1,
                        {
                          $divide: [
                            { $subtract: [new Date(), dateFilter.$gte] },
                            1000 * 60 * 60 * 24 
                          ]
                        }
                      ]
                    }
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'frame_data.user_id',
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
          $sort: { 
            period_likes: -1, 
            unique_likers_count: -1,
            like_velocity: -1,
            'frame_data.created_at': -1 
          }
        },
        { $skip: type === 'both' ? 0 : skip },
        { $limit: type === 'both' ? Math.ceil(limit / 2) : limit }
      ];

      const mostLikedFrames = await Frame.aggregate(likesAggregation);

      const likesTotalPipeline = [
        { $match: baseFilter },
        { $unwind: '$like_count' },
        ...(dateFilter ? [{ $match: { 'like_count.created_at': dateFilter } }] : []),
        {
          $group: {
            _id: '$_id'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'frame'
          }
        },
        { $unwind: '$frame' },
        {
          $lookup: {
            from: 'users',
            localField: 'frame.user_id',
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

      const likesTotalResult = await Frame.aggregate(likesTotalPipeline);
      const likesTotal = likesTotalResult[0]?.total || 0;

      results.most_liked = {
        data: mostLikedFrames.map((item, index) => ({
          rank: type === 'both' ? index + 1 : skip + index + 1,
          frame: {
            id: item.frame_data._id,
            images: item.frame_data.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
            thumbnail: item.frame_data.thumbnail ? req.protocol + '://' + req.get('host') + '/' + item.frame_data.thumbnail : null,
            title: item.frame_data.title,
            desc: item.frame_data.desc.length > 150 ? item.frame_data.desc.substring(0, 150) + '...' : item.frame_data.desc,
            layout_type: item.frame_data.layout_type,
            official_status: item.frame_data.official_status,
            tag_label: item.frame_data.tag_label,
            total_likes: item.frame_data.like_count?.length || 0,
            total_uses: item.frame_data.use_count?.length || 0,
            created_at: item.frame_data.created_at,
            updated_at: item.frame_data.updated_at
          },
          user: {
            id: item.user._id,
            name: item.user.name,
            username: item.user.username,
            image_profile: getDisplayProfileImage(item.user, req),
            role: item.user.role
          },
          trending_stats: {
            period_likes: item.period_likes,
            unique_likers_in_period: item.unique_likers_count,
            like_velocity_per_day: Math.round(item.like_velocity * 100) / 100,
            trending_score: calculateTrendingScore(item.period_likes, item.unique_likers_count, item.like_velocity, 'likes')
          }
        })),
        pagination: type === 'likes' ? {
          current_page: page,
          total_pages: Math.ceil(likesTotal / limit),
          total_items: likesTotal,
          items_per_page: limit,
          has_next_page: page < Math.ceil(likesTotal / limit),
          has_prev_page: page > 1
        } : {
          showing: mostLikedFrames.length,
          total_found: likesTotal
        }
      };
    }

    const trendingStats = await getTrendingStatistics(baseFilter, dateFilter);
    results.statistics = trendingStats;

    res.json({
      success: true,
      message: `Trending frames for ${period} period`,
      data: results
    });

  } catch (error) {
    console.error('Trending frames error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

function calculateTrendingScore(periodActivity, uniqueUsers, velocity, type) {
  const baseScore = periodActivity * 10;
  const uniquenessBonus = uniqueUsers * 5;
  const velocityBonus = velocity * 20;
  const typeMultiplier = type === 'likes' ? 1.2 : 1.0;
  
  return Math.round((baseScore + uniquenessBonus + velocityBonus) * typeMultiplier);
}

function getPeriodDescription(period) {
  switch (period) {
    case '1d':
      return 'Trending frames in the last 24 hours';
    case '3d':
      return 'Trending frames in the last 3 days';
    case '7d':
      return 'Trending frames in the last 7 days';
    case '1m':
      return 'Trending frames in the last 30 days';
    case 'all':
      return 'All-time trending frames';
    default:
      return 'Custom period trending frames';
  }
}

function getDateRangeDescription(period, dateFilter) {
  if (!dateFilter) {
    return 'All time';
  }
  
  const startDate = dateFilter.$gte;
  const endDate = new Date();
  
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    period_name: period
  };
}

async function getTrendingStatistics(baseFilter, dateFilter) {
  try {
    const stats = await Frame.aggregate([
      { $match: baseFilter },
      {
        $project: {
          like_count: 1,
          use_count: 1,
          created_at: 1,
          period_likes: {
            $size: {
              $filter: {
                input: '$like_count',
                cond: dateFilter ? { $gte: ['$$this.created_at', dateFilter.$gte] } : true
              }
            }
          },
          period_uses: {
            $size: {
              $filter: {
                input: '$use_count',
                cond: dateFilter ? { $gte: ['$$this.created_at', dateFilter.$gte] } : true
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          total_frames: { $sum: 1 },
          total_period_likes: { $sum: '$period_likes' },
          total_period_uses: { $sum: '$period_uses' },
          frames_with_activity: {
            $sum: {
              $cond: [
                { $gt: [{ $add: ['$period_likes', '$period_uses'] }, 0] },
                1,
                0
              ]
            }
          },
          avg_likes_per_frame: { $avg: '$period_likes' },
          avg_uses_per_frame: { $avg: '$period_uses' }
        }
      }
    ]);

    const result = stats[0] || {
      total_frames: 0,
      total_period_likes: 0,
      total_period_uses: 0,
      frames_with_activity: 0,
      avg_likes_per_frame: 0,
      avg_uses_per_frame: 0
    };

    return {
      total_frames_analyzed: result.total_frames,
      total_period_likes: result.total_period_likes,
      total_period_uses: result.total_period_uses,
      frames_with_activity: result.frames_with_activity,
      activity_rate: result.total_frames > 0 
        ? Math.round((result.frames_with_activity / result.total_frames) * 100 * 100) / 100
        : 0,
      average_likes_per_frame: Math.round(result.avg_likes_per_frame * 100) / 100,
      average_uses_per_frame: Math.round(result.avg_uses_per_frame * 100) / 100
    };
  } catch (error) {
    console.error('Error calculating trending statistics:', error);
    return {
      total_frames_analyzed: 0,
      total_period_likes: 0,
      total_period_uses: 0,
      frames_with_activity: 0,
      activity_rate: 0,
      average_likes_per_frame: 0,
      average_uses_per_frame: 0
    };
  }
}

module.exports = router;