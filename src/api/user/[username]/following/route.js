const express = require('express');
const mongoose = require('mongoose');
const { param, query, body, validationResult } = require('express-validator');
const Follow = require('../../../../models/Follow');
const User = require('../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../middleware/middleware');
const socketService = require('../../../../services/socketService');
const { getDisplayProfileImage } = require('../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:username/following', [
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
      }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'following.name': { $regex: search, $options: 'i' } },
            { 'following.username': { $regex: search, $options: 'i' } }
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
        let: { followingId: '$following._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$follower_id', '$$followingId'] },
                  { $eq: ['$following_id', new mongoose.Types.ObjectId(req.user.userId)] },
                  { $eq: ['$status', 'active'] }
                ]
              }
            }
          }
        ],
        as: 'mutual_follow'
      }
    });

    const following = await Follow.aggregate(pipeline);

    const totalPipeline = [
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
      }
    ];

    if (search) {
      totalPipeline.push({
        $match: {
          $or: [
            { 'following.name': { $regex: search, $options: 'i' } },
            { 'following.username': { $regex: search, $options: 'i' } }
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
          image_profile: getDisplayProfileImage(targetUser, req),
          role: targetUser.role
        },
        following: following.map(follow => ({
          id: follow.following._id,
          name: follow.following.name,
          username: follow.following.username,
          image_profile: getDisplayProfileImage(follow.following, req),
          role: follow.following.role,
          followed_since: follow.created_at,
          is_mutual: follow.mutual_follow.length > 0,
          ...(isOwnProfile && { can_unfollow: true })
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
          total_following: total
        }
      }
    });

  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/:username/following', [
  param('username').notEmpty().withMessage('Username is required'),
  body('following_username').notEmpty().withMessage('Username to follow is required')
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
        message: 'Access denied. You can only follow users from your own profile.'
      });
    }

    const userToFollow = await User.findOne({ username: req.body.following_username });
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User to follow not found'
      });
    }

    if (targetUser._id.equals(userToFollow._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    if (userToFollow.ban_status) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow banned users'
      });
    }

    const existingFollow = await Follow.findOne({
      follower_id: targetUser._id,
      following_id: userToFollow._id
    });

    if (existingFollow) {
      if (existingFollow.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'You are already following this user'
        });
      } else {
        existingFollow.status = 'active';
        await existingFollow.save();
      }
    } else {
      const newFollow = new Follow({
        follower_id: targetUser._id,
        following_id: userToFollow._id,
        status: 'active'
      });
      await newFollow.save();
    }

    try {
      await socketService.sendFollowNotification(
        userToFollow._id,
        targetUser._id,
        {
          follower_name: targetUser.name,
          follower_username: targetUser.username,
          follower_image: targetUser.image_profile
        }
      );
    } catch (notifError) {
      console.error('Failed to send follow notification:', notifError);
    }

    console.log(`FOLLOW: ${targetUser.username} followed ${userToFollow.username}`);

    res.json({
      success: true,
      message: 'Successfully followed user',
      data: {
        followed_user: {
          id: userToFollow._id,
          name: userToFollow.name,
          username: userToFollow.username,
          image_profile: getDisplayProfileImage(userToFollow, req),
          role: userToFollow.role
        },
        followed_at: new Date()
      }
    });

  } catch (error) {
    console.error('Follow user error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You are already following this user'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.delete('/:username/following/:followingId', [
  param('username').notEmpty().withMessage('Username is required'),
  param('followingId').isMongoId().withMessage('Invalid following user ID')
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
        message: 'Access denied. You can only unfollow users from your own profile.'
      });
    }

    const userToUnfollow = await User.findById(req.params.followingId);
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'User to unfollow not found'
      });
    }

    const follow = await Follow.findOneAndDelete({
      follower_id: targetUser._id,
      following_id: userToUnfollow._id,
      status: 'active'
    });

    if (!follow) {
      return res.status(404).json({
        success: false,
        message: 'Follow relationship not found'
      });
    }

    console.log(`UNFOLLOW: ${targetUser.username} unfollowed ${userToUnfollow.username}`);

    res.json({
      success: true,
      message: 'Successfully unfollowed user',
      data: {
        unfollowed_user: {
          id: userToUnfollow._id,
          name: userToUnfollow.name,
          username: userToUnfollow.username
        }
      }
    });

  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/:username/following/check/:targetUsername', [
  param('username').notEmpty().withMessage('Username is required'),
  param('targetUsername').notEmpty().withMessage('Target username is required')
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

    const checkUser = await User.findOne({ username: req.params.targetUsername });
    if (!checkUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    const follow = await Follow.findOne({
      follower_id: targetUser._id,
      following_id: checkUser._id,
      status: 'active'
    });

    const mutualFollow = await Follow.findOne({
      follower_id: checkUser._id,
      following_id: targetUser._id,
      status: 'active'
    });

    res.json({
      success: true,
      data: {
        is_following: !!follow,
        is_mutual: !!(follow && mutualFollow),
        followed_since: follow ? follow.created_at : null,
        target_user: {
          id: checkUser._id,
          name: checkUser.name,
          username: checkUser.username,
          image_profile: getDisplayProfileImage(checkUser, req)
        }
      }
    });

  } catch (error) {
    console.error('Check follow status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;