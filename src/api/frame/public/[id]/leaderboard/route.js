const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Frame = require('../../../../../models/Frame');
const { getDisplayProfileImage } = require('../../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:id/leaderboard', [
  param('id').isMongoId().withMessage('Invalid frame ID'),
  query('period').optional().isIn(['7d', '1m', 'all']).withMessage('Period must be 7d, 1m, or all'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
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

    const frameId = req.params.id;
    const period = req.query.period || 'all';
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const frame = await Frame.findOne({
      _id: frameId,
      visibility: 'public'
    }).populate('user_id', 'name username image_profile role custom_profile_image use_google_profile');

    if (!frame) {
      return res.status(404).json({
        success: false,
        message: 'Frame not found or not public'
      });
    }

    let dateFilter = {};
    const now = new Date();

    switch (period) {
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

    const pipeline = [
      { $match: { _id: frame._id } },
      { $unwind: '$use_count' },
      ...(dateFilter ? [{ $match: { 'use_count.created_at': dateFilter } }] : []),
      {
        $group: {
          _id: '$use_count.user_id',
          usage_count: { $sum: 1 },
          first_use: { $min: '$use_count.created_at' },
          latest_use: { $max: '$use_count.created_at' },
          usage_dates: { $push: '$use_count.created_at' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
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
          usage_count: -1, 
          latest_use: -1,
          first_use: 1 
        }
      },
      { $skip: skip },
      { $limit: limit }
    ];

    const leaderboard = await Frame.aggregate(pipeline);

    const totalPipeline = [
      { $match: { _id: frame._id } },
      { $unwind: '$use_count' },
      ...(dateFilter ? [{ $match: { 'use_count.created_at': dateFilter } }] : []),
      {
        $group: {
          _id: '$use_count.user_id'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
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

    const totalResult = await Frame.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const frameStatsFilter = dateFilter ? { 'use_count.created_at': dateFilter } : {};
    const frameStats = await Frame.aggregate([
      { $match: { _id: frame._id } },
      { $unwind: '$use_count' },
      ...(dateFilter ? [{ $match: frameStatsFilter }] : []),
      {
        $group: {
          _id: null,
          total_uses: { $sum: 1 },
          unique_users: { $addToSet: '$use_count.user_id' },
          first_use: { $min: '$use_count.created_at' },
          latest_use: { $max: '$use_count.created_at' }
        }
      },
      {
        $addFields: {
          unique_users_count: { $size: '$unique_users' }
        }
      }
    ]);

    const stats = frameStats[0] || {
      total_uses: 0,
      unique_users_count: 0,
      first_use: null,
      latest_use: null
    };

    const formattedLeaderboard = leaderboard.map((entry, index) => {
      const rank = skip + index + 1;
      const usagePercentage = stats.total_uses > 0 
        ? Math.round((entry.usage_count / stats.total_uses) * 100 * 100) / 100 
        : 0;

      const daysSinceFirstUse = entry.first_use 
        ? Math.max(1, Math.ceil((new Date() - entry.first_use) / (1000 * 60 * 60 * 24)))
        : 1;
      const usageFrequency = Math.round((entry.usage_count / daysSinceFirstUse) * 100) / 100;

      return {
        rank,
        user: {
          id: entry.user._id,
          name: entry.user.name,
          username: entry.user.username,
          image_profile: getDisplayProfileImage(entry.user, req),
          role: entry.user.role
        },
        usage_stats: {
          total_uses: entry.usage_count,
          percentage_of_total: usagePercentage,
          usage_frequency_per_day: usageFrequency,
          first_use: entry.first_use,
          latest_use: entry.latest_use,
          days_since_first_use: daysSinceFirstUse
        }
      };
    });

    let frameOwnerPosition = null;
    if (frame.user_id && !leaderboard.find(entry => entry.user._id.toString() === frame.user_id._id.toString())) {
      const ownerPipeline = [
        { $match: { _id: frame._id } },
        { $unwind: '$use_count' },
        ...(dateFilter ? [{ $match: { 'use_count.created_at': dateFilter } }] : []),
        {
          $group: {
            _id: '$use_count.user_id',
            usage_count: { $sum: 1 },
            first_use: { $min: '$use_count.created_at' },
            latest_use: { $max: '$use_count.created_at' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
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
            usage_count: -1, 
            latest_use: -1,
            first_use: 1 
          }
        }
      ];

      const allUsers = await Frame.aggregate(ownerPipeline);
      const ownerIndex = allUsers.findIndex(entry => 
        entry.user._id.toString() === frame.user_id._id.toString()
      );

      if (ownerIndex !== -1) {
        const ownerEntry = allUsers[ownerIndex];
        const usagePercentage = stats.total_uses > 0 
          ? Math.round((ownerEntry.usage_count / stats.total_uses) * 100 * 100) / 100 
          : 0;

        frameOwnerPosition = {
          rank: ownerIndex + 1,
          user: {
            id: frame.user_id._id,
            name: frame.user_id.name,
            username: frame.user_id.username,
            image_profile: getDisplayProfileImage(frame.user_id, req),
            role: frame.user_id.role
          },
          usage_stats: {
            total_uses: ownerEntry.usage_count,
            percentage_of_total: usagePercentage,
            first_use: ownerEntry.first_use,
            latest_use: ownerEntry.latest_use
          }
        };
      }
    }

    res.json({
      success: true,
      message: `Frame usage leaderboard for "${frame.title}"`,
      data: {
        frame: {
          id: frame._id,
          title: frame.title,
          desc: frame.desc,
          thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
          layout_type: frame.layout_type,
          official_status: frame.official_status,
          approval_status: frame.approval_status,
          tag_label: frame.tag_label,
          owner: {
            id: frame.user_id._id,
            name: frame.user_id.name,
            username: frame.user_id.username,
            image_profile: getDisplayProfileImage(frame.user_id, req),
            role: frame.user_id.role
          },
          created_at: frame.created_at,
          updated_at: frame.updated_at
        },
        leaderboard: formattedLeaderboard,
        period: {
          type: period,
          description: getPeriodDescription(period),
          date_range: getDateRangeDescription(period, dateFilter)
        },
        statistics: {
          total_uses_in_period: stats.total_uses,
          unique_users_in_period: stats.unique_users_count,
          first_use_in_period: stats.first_use,
          latest_use_in_period: stats.latest_use,
          average_uses_per_user: stats.unique_users_count > 0 
            ? Math.round((stats.total_uses / stats.unique_users_count) * 100) / 100 
            : 0
        },
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        ...(frameOwnerPosition && { frame_owner_position: frameOwnerPosition }),
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Frame leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

function getPeriodDescription(period) {
  switch (period) {
    case '7d':
      return 'Users who used this frame in the last 7 days';
    case '1m':
      return 'Users who used this frame in the last 30 days';
    case 'all':
      return 'All-time users of this frame';
    default:
      return 'Custom period users of this frame';
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

module.exports = router;