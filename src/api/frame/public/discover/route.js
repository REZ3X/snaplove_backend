const express = require('express');
const { query, validationResult } = require('express-validator');
const Frame = require('../../../../models/Frame');
const { getDisplayProfileImage } = require('../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/discover', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('layout_type').optional().isIn(['2x1', '3x1', '4x1']).withMessage('Invalid layout type'),
  query('official_only').optional().isBoolean().withMessage('Official only must be boolean'),
  query('algorithm').optional().isIn(['hybrid', 'trending', 'recent', 'random']).withMessage('Invalid algorithm type')
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

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const algorithm = req.query.algorithm || 'hybrid';

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

    let discoveryFrames = [];
    let totalCount = 0;
    let algorithmUsed = algorithm;

    totalCount = await Frame.countDocuments(baseFilter);

    switch (algorithm) {
      case 'trending':
        discoveryFrames = await getTrendingFrames(baseFilter, limit, skip);
        break;
      case 'recent':
        discoveryFrames = await getRecentFrames(baseFilter, limit, skip);
        break;
      case 'random':
        discoveryFrames = await getRandomFrames(baseFilter, limit, skip);
        break;
      case 'hybrid':
      default:
        discoveryFrames = await getHybridFrames(baseFilter, limit, skip);
        algorithmUsed = 'hybrid';
        break;
    }

    const formattedFrames = discoveryFrames.map((frame, _index) => ({
      id: frame._id,
      images: frame.images.map(img => req.protocol + '://' + req.get('host') + '/' + img),
      thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
      title: frame.title,
      desc: frame.desc.length > 200 ? frame.desc.substring(0, 200) + '...' : frame.desc,
      total_likes: frame.total_likes || (frame.like_count ? frame.like_count.length : 0),
      total_uses: frame.total_uses || (frame.use_count ? frame.use_count.length : 0),
      layout_type: frame.layout_type,
      official_status: frame.official_status,
      tag_label: frame.tag_label,
      user: {
        id: frame.user_id._id || frame.user_id,
        name: frame.user?.name || frame.user_name || 'Unknown User',
        username: frame.user?.username || frame.user_username || 'unknown',
        image_profile: frame.user ? getDisplayProfileImage(frame.user, req) : null,
        role: frame.user?.role || frame.user_role || 'basic'
      },
      discovery_stats: {
        discovery_score: frame.discovery_score || 0,
        engagement_rate: frame.engagement_rate || 0,
        recency_boost: frame.recency_boost || 0,
        trending_score: frame.trending_score || 0,
        randomization_factor: frame.randomization_factor || 0
      },
      created_at: frame.created_at,
      updated_at: frame.updated_at
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      message: `Discovery frames using ${algorithmUsed} algorithm`,
      data: {
        frames: formattedFrames,
        algorithm: {
          type: algorithmUsed,
          description: getAlgorithmDescription(algorithmUsed),
          parameters: getAlgorithmParameters(algorithmUsed)
        },
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalCount,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        filters: {
          layout_type: req.query.layout_type || null,
          official_only: req.query.official_only === 'true',
          applied_filter_count: Object.keys(req.query).filter(key => 
            ['layout_type', 'official_only'].includes(key)
          ).length
        },
        statistics: await getDiscoveryStatistics(baseFilter),
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Discovery frames error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

async function getHybridFrames(baseFilter, limit, skip) {
  try {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: baseFilter },
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

          total_likes: { $size: '$like_count' },
          total_uses: { $size: '$use_count' },

          recent_likes: {
            $size: {
              $filter: {
                input: '$like_count',
                cond: { $gte: ['$$this.created_at', last7Days] }
              }
            }
          },
          recent_uses: {
            $size: {
              $filter: {
                input: '$use_count',
                cond: { $gte: ['$$this.created_at', last7Days] }
              }
            }
          },

          monthly_likes: {
            $size: {
              $filter: {
                input: '$like_count',
                cond: { $gte: ['$$this.created_at', last30Days] }
              }
            }
          },
          monthly_uses: {
            $size: {
              $filter: {
                input: '$use_count',
                cond: { $gte: ['$$this.created_at', last30Days] }
              }
            }
          },

          frame_age_days: {
            $divide: [
              { $subtract: [now, '$created_at'] },
              1000 * 60 * 60 * 24
            ]
          },

          random_factor: { $rand: {} }
        }
      },
      {
        $addFields: {

          engagement_rate: {
            $cond: [
              { $gt: ['$frame_age_days', 0] },
              {
                $divide: [
                  { $add: ['$total_likes', '$total_uses'] },
                  { $max: ['$frame_age_days', 1] }
                ]
              },
              0
            ]
          },

          recent_activity_score: {
            $multiply: [
              { $add: ['$recent_likes', '$recent_uses'] },
              3             ]
          },

          monthly_momentum: {
            $cond: [
              { $gt: [{ $add: ['$monthly_likes', '$monthly_uses'] }, 0] },
              {
                $multiply: [
                  { $add: ['$monthly_likes', '$monthly_uses'] },
                  1.5
                ]
              },
              0
            ]
          },

          recency_boost: {
            $cond: [
              { $lte: ['$frame_age_days', 30] },
              {
                $multiply: [
                  { $subtract: [30, '$frame_age_days'] },
                  0.1
                ]
              },
              0
            ]
          },

          official_boost: {
            $cond: ['$official_status', 10, 0]
          }
        }
      },
      {
        $addFields: {

          discovery_score: {
            $add: [

              { $multiply: ['$engagement_rate', 30] },

              { $multiply: ['$recent_activity_score', 0.4] },

              { $multiply: ['$monthly_momentum', 0.2] },

              { $multiply: ['$recency_boost', 5] },

              { $multiply: ['$official_boost', 0.05] },

              { $multiply: ['$random_factor', 15] }
            ]
          }
        }
      },
      {
        $sort: { 
          discovery_score: -1,
          created_at: -1,
          _id: 1         }
      },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          images: 1,
          thumbnail: 1,
          title: 1,
          desc: 1,
          layout_type: 1,
          official_status: 1,
          tag_label: 1,
          user_id: 1,
          created_at: 1,
          updated_at: 1,
          like_count: 1,
          use_count: 1,
          user: 1,
          discovery_score: 1,
          engagement_rate: 1,
          recency_boost: 1,
          recent_activity_score: { $rename: 'trending_score' },
          random_factor: { $rename: 'randomization_factor' }
        }
      }
    ];

    return await Frame.aggregate(pipeline);
  } catch (error) {
    console.error('Hybrid algorithm error:', error);

    return await getRecentFrames(baseFilter, limit, skip);
  }
}

async function getTrendingFrames(baseFilter, limit, skip) {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const pipeline = [
    { $match: baseFilter },
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
        recent_likes: {
          $size: {
            $filter: {
              input: '$like_count',
              cond: { $gte: ['$$this.created_at', last7Days] }
            }
          }
        },
        recent_uses: {
          $size: {
            $filter: {
              input: '$use_count',
              cond: { $gte: ['$$this.created_at', last7Days] }
            }
          }
        },
        trending_score: {
          $add: [
            { $multiply: ['$recent_likes', 2] },
            '$recent_uses'
          ]
        }
      }
    },
    {
      $sort: { 
        trending_score: -1,
        created_at: -1
      }
    },
    { $skip: skip },
    { $limit: limit }
  ];

  return await Frame.aggregate(pipeline);
}

async function getRecentFrames(baseFilter, limit, skip) {
  return await Frame.find(baseFilter)
    .populate('user_id', 'name username image_profile role custom_profile_image use_google_profile ban_status')
    .sort({ created_at: -1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

async function getRandomFrames(baseFilter, limit, skip) {
  const pipeline = [
    { $match: baseFilter },
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
        total_engagement: {
          $add: [
            { $size: '$like_count' },
            { $size: '$use_count' }
          ]
        },
        random_weight: {
          $multiply: [
            { $rand: {} },
            {
              $add: [
                1,                 { $min: [{ $divide: [{ $size: '$like_count' }, 10] }, 5] },                 { $min: [{ $divide: [{ $size: '$use_count' }, 5] }, 3] }               ]
            }
          ]
        }
      }
    },
    {
      $sort: { random_weight: -1 }
    },
    { $skip: skip },
    { $limit: limit }
  ];

  return await Frame.aggregate(pipeline);
}

function getAlgorithmDescription(algorithm) {
  const descriptions = {
    hybrid: 'Intelligent mix of trending signals, recency, engagement, and randomization for optimal discovery',
    trending: 'Frames with high recent engagement and growing popularity in the last 7 days',
    recent: 'Newly created frames sorted by creation date for fresh content discovery',
    random: 'Weighted randomization favoring frames with higher engagement for serendipitous discovery'
  };
  return descriptions[algorithm] || 'Custom discovery algorithm';
}

function getAlgorithmParameters(algorithm) {
  const parameters = {
    hybrid: {
      engagement_weight: '30%',
      recent_activity_weight: '40%',
      monthly_momentum_weight: '20%',
      recency_boost_weight: '5%',
      randomization_weight: '5%',
      time_windows: ['7 days recent', '30 days momentum', '30 days recency boost'],
      official_boost: 'Yes'
    },
    trending: {
      time_window: '7 days',
      likes_multiplier: '2x',
      uses_multiplier: '1x',
      sort_priority: 'Recent engagement'
    },
    recent: {
      sort_field: 'created_at',
      sort_order: 'descending',
      bias: 'Newest content first'
    },
    random: {
      base_weight: '1.0',
      like_bonus: 'Up to 5.0 (1 per 10 likes)',
      use_bonus: 'Up to 3.0 (1 per 5 uses)',
      randomization: 'Weighted by engagement'
    }
  };
  return parameters[algorithm] || {};
}

async function getDiscoveryStatistics(baseFilter) {
  try {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = await Frame.aggregate([
      { $match: baseFilter },
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
        $group: {
          _id: null,
          total_frames: { $sum: 1 },
          total_likes: { $sum: { $size: '$like_count' } },
          total_uses: { $sum: { $size: '$use_count' } },
          official_frames: {
            $sum: { $cond: ['$official_status', 1, 0] }
          },
          recent_frames: {
            $sum: {
              $cond: [
                { $gte: ['$created_at', last7Days] },
                1,
                0
              ]
            }
          },
          active_frames: {
            $sum: {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: {
                            $concatArrays: ['$like_count', '$use_count']
                          },
                          cond: { $gte: ['$$this.created_at', last30Days] }
                        }
                      }
                    },
                    0
                  ]
                },
                1,
                0
              ]
            }
          },
          avg_likes_per_frame: { $avg: { $size: '$like_count' } },
          avg_uses_per_frame: { $avg: { $size: '$use_count' } }
        }
      }
    ]);

    const result = stats[0] || {
      total_frames: 0,
      total_likes: 0,
      total_uses: 0,
      official_frames: 0,
      recent_frames: 0,
      active_frames: 0,
      avg_likes_per_frame: 0,
      avg_uses_per_frame: 0
    };

    return {
      total_discoverable_frames: result.total_frames,
      total_engagement: result.total_likes + result.total_uses,
      official_content_percentage: result.total_frames > 0 
        ? Math.round((result.official_frames / result.total_frames) * 100 * 100) / 100
        : 0,
      recent_content_percentage: result.total_frames > 0
        ? Math.round((result.recent_frames / result.total_frames) * 100 * 100) / 100
        : 0,
      active_content_percentage: result.total_frames > 0
        ? Math.round((result.active_frames / result.total_frames) * 100 * 100) / 100
        : 0,
      average_engagement_per_frame: {
        likes: Math.round(result.avg_likes_per_frame * 100) / 100,
        uses: Math.round(result.avg_uses_per_frame * 100) / 100,
        total: Math.round((result.avg_likes_per_frame + result.avg_uses_per_frame) * 100) / 100
      },
      discovery_health_score: calculateDiscoveryHealthScore(result)
    };
  } catch (error) {
    console.error('Error calculating discovery statistics:', error);
    return {
      total_discoverable_frames: 0,
      total_engagement: 0,
      official_content_percentage: 0,
      recent_content_percentage: 0,
      active_content_percentage: 0,
      average_engagement_per_frame: { likes: 0, uses: 0, total: 0 },
      discovery_health_score: 0
    };
  }
}

function calculateDiscoveryHealthScore(stats) {
  if (stats.total_frames === 0) return 0;

  const factors = {
    content_volume: Math.min(stats.total_frames / 100, 1) * 25,     engagement_rate: Math.min((stats.avg_likes_per_frame + stats.avg_uses_per_frame) / 10, 1) * 30,     freshness: (stats.recent_frames / stats.total_frames) * 25,     activity: (stats.active_frames / stats.total_frames) * 20   };

  const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);
  return Math.round(totalScore * 100) / 100;
}

module.exports = router;