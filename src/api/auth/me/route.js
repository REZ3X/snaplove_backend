const express = require('express');
const { authenticateToken, checkBanStatus } = require('../../../middleware');

const router = express.Router();

router.get('/', authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const user = req.currentUser;

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
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        permissions: {
          can_edit_profile: true,
          can_create_content: !user.ban_status,
          is_admin: ['official', 'developer'].includes(user.role)
        }
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;