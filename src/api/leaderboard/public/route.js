const express = require('express');
const { query, validationResult } = require('express-validator');
const Frame = require('../../../models/Frame');

const router = express.Router();

router.get('/', [
  query('period').optional().isIn(['7d', '1m', 'all']).withMessage('Period must be 7d, 1m, or all'),
  query('type').optional().isIn(['likes', 'uses', 'combined']).withMessage('Type must be likes, uses, or combined'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
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

    const period = req.query.period || '7d';
    const type = req.query.type || 'combined';
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case '7d':
        dateFilter = { created_at: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '1m':
        dateFilter = { created_at: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case 'all':
      default:
        dateFilter = {};
        break;
    }

    const basePipeline = [
      {
        $match: {
          visibility: 'public',
          approval_status: 'approved',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$user_id',
          total_likes: { $sum: { $size: '$like_count' } },
          total_uses: { $sum: { $size: '$use_count' } },
          frame_count: { $sum: 1 },
          frames: {
            $push: {
              id: '$_id',
              title: '$title',
              thumbnail: '$thumbnail',
              likes: { $size: '$like_count' },
              uses: { $size: '$use_count' },
              created_at: '$created_at'
            }
          }
        }
      }
    ];

    let sortStage = {};
    switch (type) {
      case 'likes':
        basePipeline.push({
          $addFields: {
            score: '$total_likes',
            type: 'likes'
          }
        });
        sortStage = { score: -1, total_uses: -1, frame_count: -1 };
        break;
      case 'uses':
        basePipeline.push({
          $addFields: {
            score: '$total_uses',
            type: 'uses'
          }
        });
        sortStage = { score: -1, total_likes: -1, frame_count: -1 };
        break;
      case 'combined':
      default:
        basePipeline.push({
          $addFields: {
            score: {
              $add: [
                { $multiply: ['$total_likes', 2] },
                '$total_uses'
              ]
            },
            type: 'combined'
          }
        });
        sortStage = { score: -1, total_likes: -1, total_uses: -1, frame_count: -1 };
        break;
    }

    basePipeline.push(
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $match: {
          'user.ban_status': false
        }
      }
    );


    const leaderboard = await Frame.aggregate(basePipeline);

    const totalCountPipeline = [
      {
        $match: {
          visibility: 'public',
          approval_status: 'approved',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$user_id'
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
      {
        $unwind: '$user'
      },
      {
        $match: {
          'user.ban_status': false
        }
      },
      {
        $count: 'total'
      }
    ];

    const totalCountResult = await Frame.aggregate(totalCountPipeline);
    const totalCount = totalCountResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    const periodStats = await Frame.aggregate([
      {
        $match: {
          visibility: 'public',
          approval_status: 'approved',
          ...dateFilter
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $match: {
          'user.ban_status': false
        }
      },
      {
        $group: {
          _id: null,
          total_frames: { $sum: 1 },
          total_likes: { $sum: { $size: '$like_count' } },
          total_uses: { $sum: { $size: '$use_count' } },
          unique_creators: { $addToSet: '$user_id' },
          avg_likes_per_frame: { $avg: { $size: '$like_count' } },
          avg_uses_per_frame: { $avg: { $size: '$use_count' } }
        }
      },
      {
        $addFields: {
          unique_creators_count: { $size: '$unique_creators' }
        }
      }
    ]);

    const stats = periodStats[0] || {
      total_frames: 0,
      total_likes: 0,
      total_uses: 0,
      unique_creators_count: 0,
      avg_likes_per_frame: 0,
      avg_uses_per_frame: 0
    };

    const formattedLeaderboard = leaderboard.map((entry, index) => {
      const avgLikes = entry.frame_count > 0 ? Math.round((entry.total_likes / entry.frame_count) * 100) / 100 : 0;
      const avgUses = entry.frame_count > 0 ? Math.round((entry.total_uses / entry.frame_count) * 100) / 100 : 0;

      const topFrames = entry.frames
        .sort((a, b) => (b.likes + b.uses) - (a.likes + a.uses))
        .slice(0, 3)
        .map(frame => ({
          id: frame.id,
          title: frame.title,
          thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
          likes: frame.likes,
          uses: frame.uses,
          total_interactions: frame.likes + frame.uses,
          created_at: frame.created_at
        }));

      return {
        rank: skip + index + 1,
        user: {
          id: entry.user._id,
          name: entry.user.name,
          username: entry.user.username,
          image_profile: entry.user.image_profile,
          role: entry.user.role
        },
        stats: {
          score: entry.score,
          total_likes: entry.total_likes,
          total_uses: entry.total_uses,
          frame_count: entry.frame_count,
          avg_likes_per_frame: avgLikes,
          avg_uses_per_frame: avgUses
        },
        top_frames: topFrames,
        period_joined: entry.user.created_at
      };
    });

    res.json({
      success: true,
      data: {
        leaderboard: formattedLeaderboard,
        period: {
          type: period,
          ranking_type: type,
          description: getPeriodDescription(period),
          scoring_info: getScoringInfo(type)
        },
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalCount,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        statistics: {
          period_stats: {
            total_frames: stats.total_frames,
            total_likes: stats.total_likes,
            total_uses: stats.total_uses,
            unique_creators: stats.unique_creators_count,
            avg_likes_per_frame: Math.round(stats.avg_likes_per_frame * 100) / 100,
            avg_uses_per_frame: Math.round(stats.avg_uses_per_frame * 100) / 100
          }
        },
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

function getPeriodDescription(period) {
  switch (period) {
    case '7d':
      return 'Last 7 days ranking based on frames created in this period';
    case '1m':
      return 'Last 30 days ranking based on frames created in this period';
    case 'all':
      return 'All-time ranking based on all approved public frames';
    default:
      return 'Custom period ranking';
  }
}

function getScoringInfo(type) {
  switch (type) {
    case 'likes':
      return 'Ranked by total likes received on public frames';
    case 'uses':
      return 'Ranked by total uses of public frames by other users';
    case 'combined':
      return 'Ranked by combined score: (Likes × 2) + Uses';
    default:
      return 'Custom scoring system';
  }
}

module.exports = router;