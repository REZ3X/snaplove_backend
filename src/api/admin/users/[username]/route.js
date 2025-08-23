const express = require('express');
const { param, validationResult } = require('express-validator');
const User = require('../../../../models/User');
const Frame = require('../../../../models/Frame');
const Photo = require('../../../../models/Photo');
const { authenticateToken, checkBanStatus, requireAdmin } = require('../../../../middleware');

const router = express.Router();

router.get('/:username', [
  param('username').notEmpty().withMessage('Username is required')
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

    const user = await User.findOne({ username: req.params.username })
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const [frameStats, photoStats] = await Promise.all([
      Frame.aggregate([
        { $match: { user_id: user._id } },
        {
          $group: {
            _id: '$visibility',
            count: { $sum: 1 },
            total_likes: { $sum: { $size: '$like_count' } },
            total_uses: { $sum: { $size: '$use_count' } }
          }
        }
      ]),
      Photo.aggregate([
        { $match: { user_id: user._id } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const [recentFrames, recentPhotos] = await Promise.all([
      Frame.find({ user_id: user._id })
        .select('title visibility created_at like_count use_count')
        .sort({ created_at: -1 })
        .limit(5),
      Photo.find({ user_id: user._id })
        .select('title created_at')
        .sort({ created_at: -1 })
        .limit(5)
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          image_profile: user.image_profile,
          role: user.role,
          bio: user.bio,
          birthdate: user.birthdate,
          ban_status: user.ban_status,
          ban_release_datetime: user.ban_release_datetime,
          google_id: user.google_id ? 'Connected' : 'Not Connected',
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        statistics: {
          frames: {
            public: frameStats.find(s => s._id === 'public')?.count || 0,
            private: frameStats.find(s => s._id === 'private')?.count || 0,
            total_frame_likes: frameStats.reduce((sum, s) => sum + (s.total_likes || 0), 0),
            total_frame_uses: frameStats.reduce((sum, s) => sum + (s.total_uses || 0), 0)
          },
          photos: {
            total: photoStats[0]?.count || 0
          },
        },
        recent_activity: {
          frames: recentFrames.map(frame => ({
            id: frame._id,
            title: frame.title,
            visibility: frame.visibility,
            likes: frame.like_count?.length || 0,
            uses: frame.use_count?.length || 0,
            created_at: frame.created_at
          })),
          posts: recentPhotos.map(photo => ({
            id: photo._id,
            title: photo.title,
            created_at: photo.created_at
          }))
        }
      }
    });

  } catch (error) {
    console.error('Admin get user detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;