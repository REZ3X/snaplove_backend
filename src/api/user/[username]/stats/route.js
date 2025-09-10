const express = require('express');
const { param, validationResult } = require('express-validator');
const Frame = require('../../../../models/Frame');
const User = require('../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../middleware/middleware');
const Follow = require('../../../../models/Follow');
const { getDisplayProfileImage } = require('../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:username/stats', [
  param('username').notEmpty().withMessage('Username is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isOwnStats = req.user.userId === targetUser._id.toString();

    const frameStats = await Frame.aggregate([
      {
        $match: {
          user_id: targetUser._id,
          visibility: 'public'
        }
      },
      {
        $group: {
          _id: '$approval_status',
          count: { $sum: 1 },
          total_likes: { $sum: { $size: '$like_count' } },
          total_uses: { $sum: { $size: '$use_count' } },
          frames: { $push: '$$ROOT' }
        }
      }
    ]);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [followerStats, followingStats] = await Promise.all([
      Follow.aggregate([
        {
          $match: {
            following_id: targetUser._id,
            status: 'active'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'follower_id',
            foreignField: '_id',
            as: 'follower'
          }
        },
        {
          $unwind: '$follower'
        },
        {
          $match: {
            'follower.ban_status': false
          }
        },
        {
          $group: {
            _id: null,
            total_followers: { $sum: 1 },
            recent_followers: {
              $sum: {
                $cond: [
                  { $gte: ['$created_at', thirtyDaysAgo] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      Follow.aggregate([
        {
          $match: {
            follower_id: targetUser._id,
            status: 'active'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'following_id',
            foreignField: '_id',
            as: 'following'
          }
        },
        {
          $unwind: '$following'
        },
        {
          $match: {
            'following.ban_status': false
          }
        },
        {
          $group: {
            _id: null,
            total_following: { $sum: 1 },
            recent_following: {
              $sum: {
                $cond: [
                  { $gte: ['$created_at', thirtyDaysAgo] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const followerData = followerStats[0] || { total_followers: 0, recent_followers: 0 };
    const followingData = followingStats[0] || { total_following: 0, recent_following: 0 };

    const approvedFrameStats = frameStats.find(stat => stat._id === 'approved') || {
      count: 0,
      total_likes: 0,
      total_uses: 0,
      frames: []
    };

    const allFrameStats = {
      approved: approvedFrameStats,
      pending: frameStats.find(stat => stat._id === 'pending') || { count: 0, total_likes: 0, total_uses: 0 },
      rejected: frameStats.find(stat => stat._id === 'rejected') || { count: 0, total_likes: 0, total_uses: 0 }
    };

    const topFramesFilter = {
      user_id: targetUser._id,
      visibility: 'public'
    };

    if (!isOwnStats) {
      topFramesFilter.approval_status = 'approved';
    }

    const topFrames = await Frame.aggregate([
      {
        $match: topFramesFilter
      },
      {
        $addFields: {
          total_interactions: {
            $add: [
              { $size: '$like_count' },
              { $size: '$use_count' }
            ]
          }
        }
      },
      {
        $sort: { total_interactions: -1, created_at: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          title: 1,
          thumbnail: 1,
          images: 1,
          layout_type: 1,
          like_count: 1,
          use_count: 1,
          approval_status: 1,
          created_at: 1,
          total_interactions: 1
        }
      }
    ]);


    const recentActivityFilter = {
      user_id: targetUser._id,
      visibility: 'public',
      created_at: { $gte: thirtyDaysAgo }
    };

    if (!isOwnStats) {
      recentActivityFilter.approval_status = 'approved';
    }

    const recentFrames = await Frame.find(recentActivityFilter)
      .sort({ created_at: -1 })
      .limit(10)
      .select('title thumbnail like_count use_count approval_status created_at');

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const growthFilter = {
      user_id: targetUser._id,
      visibility: 'public'
    };

    if (!isOwnStats) {
      growthFilter.approval_status = 'approved';
    }

    const [currentPeriod, previousPeriod] = await Promise.all([
      Frame.aggregate([
        {
          $match: {
            ...growthFilter,
            created_at: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            frames_created: { $sum: 1 },
            total_likes: { $sum: { $size: '$like_count' } },
            total_uses: { $sum: { $size: '$use_count' } }
          }
        }
      ]),
      Frame.aggregate([
        {
          $match: {
            ...growthFilter,
            created_at: {
              $gte: sixtyDaysAgo,
              $lt: thirtyDaysAgo
            }
          }
        },
        {
          $group: {
            _id: null,
            frames_created: { $sum: 1 },
            total_likes: { $sum: { $size: '$like_count' } },
            total_uses: { $sum: { $size: '$use_count' } }
          }
        }
      ])
    ]);

    const currentStats = currentPeriod[0] || { frames_created: 0, total_likes: 0, total_uses: 0 };
    const previousStats = previousPeriod[0] || { frames_created: 0, total_likes: 0, total_uses: 0 };

    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const growth = {
      frames: calculateGrowth(currentStats.frames_created, previousStats.frames_created),
      likes: calculateGrowth(currentStats.total_likes, previousStats.total_likes),
      uses: calculateGrowth(currentStats.total_uses, previousStats.total_uses)
    };

    const publicStats = {
      user: {
        id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        image_profile: getDisplayProfileImage(targetUser, req),
        role: targetUser.role
      },
      public_frames: {
        total_approved: approvedFrameStats.count,
        total_likes_received: approvedFrameStats.total_likes,
        total_uses_received: approvedFrameStats.total_uses,
        average_likes_per_frame: approvedFrameStats.count > 0
          ? Math.round(approvedFrameStats.total_likes / approvedFrameStats.count * 100) / 100
          : 0,
        average_uses_per_frame: approvedFrameStats.count > 0
          ? Math.round(approvedFrameStats.total_uses / approvedFrameStats.count * 100) / 100
          : 0
      },
      social_stats: {
        followers: followerData.total_followers,
        following: followingData.total_following,
        ...(isOwnStats && {
          recent_followers_30d: followerData.recent_followers,
          recent_following_30d: followingData.recent_following
        })
      },
      top_frames: topFrames.map(frame => ({
        id: frame._id,
        title: frame.title,
        thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
        layout_type: frame.layout_type,
        total_likes: frame.like_count.length,
        total_uses: frame.use_count.length,
        total_interactions: frame.total_interactions,
        ...(isOwnStats && { approval_status: frame.approval_status }),
        created_at: frame.created_at
      })),
      recent_activity: {
        frames_last_30_days: recentFrames.map(frame => ({
          id: frame._id,
          title: frame.title,
          thumbnail: frame.thumbnail ? req.protocol + '://' + req.get('host') + '/' + frame.thumbnail : null,
          total_likes: frame.like_count.length,
          total_uses: frame.use_count.length,
          ...(isOwnStats && { approval_status: frame.approval_status }),
          created_at: frame.created_at
        }))
      },
      growth_metrics: {
        last_30_days: {
          frames_created: currentStats.frames_created,
          likes_received: currentStats.total_likes,
          uses_received: currentStats.total_uses,
          growth_percentage: {
            frames: growth.frames,
            likes: growth.likes,
            uses: growth.uses
          }
        }
      }
    };

    if (isOwnStats) {
      publicStats.private_stats = {
        frame_breakdown: {
          approved: allFrameStats.approved.count,
          pending: allFrameStats.pending.count,
          rejected: allFrameStats.rejected.count,
          total_public: allFrameStats.approved.count + allFrameStats.pending.count + allFrameStats.rejected.count
        },
        detailed_stats: {
          approved: {
            count: allFrameStats.approved.count,
            total_likes: allFrameStats.approved.total_likes,
            total_uses: allFrameStats.approved.total_uses
          },
          pending: {
            count: allFrameStats.pending.count,
            total_likes: allFrameStats.pending.total_likes,
            total_uses: allFrameStats.pending.total_uses
          },
          rejected: {
            count: allFrameStats.rejected.count,
            total_likes: allFrameStats.rejected.total_likes,
            total_uses: allFrameStats.rejected.total_uses
          }
        }
      };
    }

    res.json({
      success: true,
      data: publicStats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;