const express = require('express');
const { param, validationResult } = require('express-validator');
const User = require('../../../../models/User');
const { authenticateToken, checkBanStatus } = require('../../../../middleware/middleware');
const { getDisplayProfileImage } = require('../../../../utils/profileImageHelper');

const router = express.Router();

router.get('/:username/birthday', [
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

    const isOwnProfile = req.user.userId === targetUser._id.toString();
    const birthdayBadge = targetUser.birthday_badge;

    let daysUntilBirthday = null;
    if (targetUser.birthdate && !birthdayBadge.is_birthday) {
      const today = new Date();
      const birthday = new Date(targetUser.birthdate);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }
      
      const timeDiff = thisYearBirthday.getTime() - today.getTime();
      daysUntilBirthday = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    const response = {
      user: {
        id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username,
        image_profile: getDisplayProfileImage(targetUser, req),
        role: targetUser.role
      },
      birthday_info: {
        has_birthday: !!targetUser.birthdate,
        is_birthday_today: birthdayBadge.is_birthday,
        days_until_birthday: daysUntilBirthday,
        badge: birthdayBadge,

        birthdate: (isOwnProfile || birthdayBadge.is_birthday) ? targetUser.birthdate : null
      }
    };

    if (isOwnProfile) {
      response.birthday_info.birthdate_changeable = !targetUser.birthdate_changed;
      response.birthday_info.birthdate_changed_at = targetUser.birthdate_changed_at;
      response.birthday_info.last_birthday_notification = targetUser.last_birthday_notification;
    }

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Get birthday info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/today', authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const birthdayUsers = await User.find({
      birthdate: {
        $ne: null
      },
      ban_status: false,
      $expr: {
        $and: [
          { $eq: [{ $month: '$birthdate' }, todayMonth + 1] },           { $eq: [{ $dayOfMonth: '$birthdate' }, todayDate] }
        ]
      }
    }).select('name username image_profile role birthdate created_at').limit(50);

    const formattedUsers = birthdayUsers.map(user => {
      const birthdayBadge = user.birthday_badge;
      return {
        id: user._id,
        name: user.name,
        username: user.username,
        image_profile: getDisplayProfileImage(user, req),
        role: user.role,
        age: birthdayBadge.age,
        badge_text: birthdayBadge.badge_text,
        member_since: user.created_at
      };
    });

    res.json({
      success: true,
      message: `Found ${formattedUsers.length} birthday${formattedUsers.length !== 1 ? 's' : ''} today!`,
      data: {
        birthday_users: formattedUsers,
        total_count: formattedUsers.length,
        date: today.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Get birthday users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;