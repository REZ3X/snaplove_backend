const express = require('express');
const mongoose = require('mongoose');
const { param, query, validationResult } = require('express-validator');
const Follow = require('../../../../models/Follow');
const User = require('../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../middleware/middleware');

const router = express.Router();

router.get('/:username/follower', [
  param('username').notEmpty().withMessage('Username is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('search').optional().isLength({ min: 1, max: 50 }).withMessage('Search must be 1-50 characters')
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

    const isOwnProfile = req.user.userId === targetUser._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search;

    const pipeline = [
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
      }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'follower.name': { $regex: search, $options: 'i' } },
            { 'follower.username': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    pipeline.push(
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: limit }
    );

    pipeline.push({
      $lookup: {
        from: 'follows',
        let: { followerId: '$follower._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$follower_id', new mongoose.Types.ObjectId(req.user.userId)] },
                  { $eq: ['$following_id', '$$followerId'] },
                  { $eq: ['$status', 'active'] }
                ]
              }
            }
          }
        ],
        as: 'mutual_follow'
      }
    });

    const followers = await Follow.aggregate(pipeline);

    const totalPipeline = [
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
      }
    ];

    if (search) {
      totalPipeline.push({
        $match: {
          $or: [
            { 'follower.name': { $regex: search, $options: 'i' } },
            { 'follower.username': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    totalPipeline.push({ $count: 'total' });

    const totalResult = await Follow.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          image_profile: targetUser.image_profile,
          role: targetUser.role
        },
        followers: followers.map(follow => ({
          id: follow.follower._id,
          name: follow.follower.name,
          username: follow.follower.username,
          image_profile: follow.follower.image_profile,
          role: follow.follower.role,
          followed_since: follow.created_at,
          is_mutual: follow.mutual_follow.length > 0,
          ...(isOwnProfile && { can_remove: true })
        })),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        },
        counts: {
          total_followers: total
        }
      }
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.delete('/:username/follower/:followerId', [
  param('username').notEmpty().withMessage('Username is required'),
  param('followerId').isMongoId().withMessage('Invalid follower ID')
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

    if (req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only remove followers from your own profile.'
      });
    }

    const followerUser = await User.findById(req.params.followerId);
    if (!followerUser) {
      return res.status(404).json({
        success: false,
        message: 'Follower not found'
      });
    }

    const follow = await Follow.findOneAndDelete({
      follower_id: req.params.followerId,
      following_id: targetUser._id,
      status: 'active'
    });

    if (!follow) {
      return res.status(404).json({
        success: false,
        message: 'Follow relationship not found'
      });
    }

    console.log(`FOLLOWER REMOVED: ${targetUser.username} removed follower ${followerUser.username}`);

    res.json({
      success: true,
      message: 'Follower removed successfully',
      data: {
        removed_follower: {
          id: followerUser._id,
          name: followerUser.name,
          username: followerUser.username
        }
      }
    });

  } catch (error) {
    console.error('Remove follower error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;