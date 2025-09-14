const express = require('express');
const { body, param, validationResult } = require('express-validator');
const discordHandler = require('../../../utils/DiscordHookHandler');
const User = require('../../../models/User');
const Frame = require('../../../models/Frame');
const Report = require('../../../models/Report');
const Ticket = require('../../../models/Ticket');
const Broadcast = require('../../../models/Broadcast');
const socketService = require('../../../services/socketService');

const router = express.Router();

const discordAuth = (req, res, next) => {
  const discordToken = req.headers['x-discord-token'];
  const discordUserId = req.headers['x-discord-user'];

  if (!discordToken || !discordUserId) {
    return res.status(401).json({
      success: false,
      message: 'Discord authentication required'
    });
  }

  const session = discordHandler.validateSessionToken(discordToken);
  if (!session || session.discordUserId !== discordUserId) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired Discord session'
    });
  }

  if (!discordHandler.isAuthorizedAdmin(discordUserId)) {
    return res.status(403).json({
      success: false,
      message: 'Discord user not authorized for admin actions'
    });
  }

  req.discordUser = { id: discordUserId };
  next();
};

router.post('/auth', [
  body('discord_user_id').notEmpty().withMessage('Discord user ID required'),
  body('discord_username').optional().isString()
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

    const { discord_user_id, discord_username } = req.body;

    if (!discordHandler.isAuthorizedAdmin(discord_user_id)) {
      await discordHandler.sendError(
        `Unauthorized access attempt by ${discord_username || discord_user_id}`,
        'User not in admin whitelist'
      );
      
      return res.status(403).json({
        success: false,
        message: 'Discord user not authorized'
      });
    }

    const token = discordHandler.generateSessionToken(discord_user_id);

    res.json({
      success: true,
      data: {
        token,
        expires_in: 300,         discord_user_id
      }
    });

  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/frames', discordAuth, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit) || 10, 25);

    const filter = { 
      visibility: 'public',
      ...(status !== 'all' && { approval_status: status })
    };

    const frames = await Frame.find(filter)
      .populate('user_id', 'name username role')
      .sort({ created_at: -1 })
      .limit(limit);

    const fields = frames.map(frame => ({
      name: `${frame.title} (${frame.approval_status})`,
      value: `ID: \`${frame._id}\`\nBy: @${frame.user_id.username}\nLikes: ${frame.like_count?.length || 0}`,
      inline: true
    }));

    await discordHandler.sendEmbed(
      `🖼️ Frames (${status})`,
      `Found ${frames.length} frames`,
      fields.slice(0, 10),       0x3498db
    );

    res.json({
      success: true,
      data: { frames: frames.length }
    });

  } catch (error) {
    console.error('Discord frames command error:', error);
    await discordHandler.sendError('Failed to fetch frames', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/frame/:id/approve', [
  param('id').isMongoId().withMessage('Invalid frame ID')
], discordAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await discordHandler.sendError('Invalid frame ID format');
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const frame = await Frame.findOne({
      _id: req.params.id,
      visibility: 'public'
    }).populate('user_id', 'name username email');

    if (!frame) {
      await discordHandler.sendError('Frame not found');
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    if (frame.approval_status === 'approved') {
      await discordHandler.sendError('Frame is already approved');
      return res.status(400).json({
        success: false,
        message: 'Frame is already approved'
      });
    }

    const adminUser = await User.findOne({
      role: { $in: ['official', 'developer'] }
    }).sort({ created_at: 1 }); 
    frame.approval_status = 'approved';
    frame.approved_by = adminUser._id;
    frame.approved_at = new Date();
    await frame.save();

    try {
      await socketService.sendFrameApprovalNotification(
        frame.user_id._id,
        {
          id: frame._id,
          title: frame.title,
          thumbnail: frame.thumbnail
        },
        'approved'
      );
    } catch (notifError) {
      console.error('Failed to send approval notification:', notifError);
    }

    await discordHandler.sendSuccess(
      `Frame approved successfully! 🎉`,
      [
        { name: 'Frame', value: frame.title, inline: true },
        { name: 'Creator', value: `@${frame.user_id.username}`, inline: true },
        { name: 'ID', value: `\`${frame._id}\``, inline: false }
      ]
    );

    console.log(`📢 DISCORD APPROVAL: Frame ${frame._id} approved via Discord by ${req.discordUser.id}`);

    res.json({
      success: true,
      message: 'Frame approved successfully',
      data: { frame_id: frame._id }
    });

  } catch (error) {
    console.error('Discord frame approval error:', error);
    await discordHandler.sendError('Failed to approve frame', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/frame/:id/reject', [
  param('id').isMongoId().withMessage('Invalid frame ID'),
  body('reason').isLength({ min: 1, max: 500 }).withMessage('Rejection reason required (1-500 chars)')
], discordAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await discordHandler.sendError('Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const frame = await Frame.findOne({
      _id: req.params.id,
      visibility: 'public'
    }).populate('user_id', 'name username email');

    if (!frame) {
      await discordHandler.sendError('Frame not found');
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const { reason } = req.body;
    const adminUser = await User.findOne({
      role: { $in: ['official', 'developer'] }
    }).sort({ created_at: 1 });

    frame.approval_status = 'rejected';
    frame.approved_by = adminUser._id;
    frame.approved_at = new Date();
    frame.rejection_reason = reason.trim();
    await frame.save();

    try {
      await socketService.sendFrameApprovalNotification(
        frame.user_id._id,
        {
          id: frame._id,
          title: frame.title,
          thumbnail: frame.thumbnail
        },
        'rejected',
        reason
      );
    } catch (notifError) {
      console.error('Failed to send rejection notification:', notifError);
    }

    await discordHandler.sendSuccess(
      `Frame rejected successfully`,
      [
        { name: 'Frame', value: frame.title, inline: true },
        { name: 'Creator', value: `@${frame.user_id.username}`, inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'ID', value: `\`${frame._id}\``, inline: false }
      ]
    );

    console.log(`📢 DISCORD REJECTION: Frame ${frame._id} rejected via Discord by ${req.discordUser.id}`);

    res.json({
      success: true,
      message: 'Frame rejected successfully',
      data: { frame_id: frame._id, reason }
    });

  } catch (error) {
    console.error('Discord frame rejection error:', error);
    await discordHandler.sendError('Failed to reject frame', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/users', discordAuth, async (req, res) => {
  try {
    const role = req.query.role;
    const limit = Math.min(parseInt(req.query.limit) || 10, 25);

    const filter = {
      ...(role && { role })
    };

    const users = await User.find(filter)
      .select('name username role ban_status created_at')
      .sort({ created_at: -1 })
      .limit(limit);

    const fields = users.map(user => ({
      name: `@${user.username} (${user.role})`,
      value: `Status: ${user.ban_status ? '🔴 Banned' : '🟢 Active'}\nJoined: ${new Date(user.created_at).toLocaleDateString()}`,
      inline: true
    }));

    await discordHandler.sendEmbed(
      `👥 Users ${role ? `(${role})` : ''}`,
      `Found ${users.length} users`,
      fields.slice(0, 10),
      0xe67e22
    );

    res.json({
      success: true,
      data: { users: users.length }
    });

  } catch (error) {
    console.error('Discord users command error:', error);
    await discordHandler.sendError('Failed to fetch users', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/user/:username/ban', [
  param('username').notEmpty().withMessage('Username required'),
  body('duration').optional().isString(),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason too long')
], discordAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await discordHandler.sendError('Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      await discordHandler.sendError('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (['official', 'developer'].includes(user.role)) {
      await discordHandler.sendError('Cannot ban admin users');
      return res.status(403).json({
        success: false,
        message: 'Cannot ban admin users'
      });
    }

    const { duration, reason } = req.body;

    let banReleaseDate = null;
    if (duration) {
      const durationMatch = duration.match(/^(\d+)([dhm])$/);
      if (durationMatch) {
        const [, amount, unit] = durationMatch;
        const now = new Date();
        switch (unit) {
          case 'd': banReleaseDate = new Date(now.getTime() + parseInt(amount) * 24 * 60 * 60 * 1000); break;
          case 'h': banReleaseDate = new Date(now.getTime() + parseInt(amount) * 60 * 60 * 1000); break;
          case 'm': banReleaseDate = new Date(now.getTime() + parseInt(amount) * 60 * 1000); break;
        }
      }
    }

    user.ban_status = true;
    user.ban_release_datetime = banReleaseDate;
    await user.save();

    await discordHandler.sendSuccess(
      `User banned successfully! 🔨`,
      [
        { name: 'User', value: `@${user.username}`, inline: true },
        { name: 'Duration', value: duration || 'Permanent', inline: true },
        { name: 'Release', value: banReleaseDate ? banReleaseDate.toLocaleString() : 'Never', inline: true },
        { name: 'Reason', value: reason || 'No reason provided', inline: false }
      ]
    );

    console.log(`📢 DISCORD BAN: User ${user.username} banned via Discord by ${req.discordUser.id}`);

    res.json({
      success: true,
      message: 'User banned successfully',
      data: {
        username: user.username,
        ban_release_datetime: banReleaseDate,
        reason
      }
    });

  } catch (error) {
    console.error('Discord user ban error:', error);
    await discordHandler.sendError('Failed to ban user', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/broadcast', [
  body('message').isLength({ min: 1, max: 500 }).withMessage('Message required (1-500 chars)'),
  body('target_audience').optional().isIn(['all', 'verified', 'premium', 'basic']).withMessage('Invalid audience'),
  body('type').optional().isIn(['announcement', 'maintenance', 'update', 'alert']).withMessage('Invalid type')
], discordAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await discordHandler.sendError('Validation failed: ' + errors.array().map(e => e.msg).join(', '));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { message, target_audience = 'all', type = 'announcement' } = req.body;

    const adminUser = await User.findOne({
      role: { $in: ['official', 'developer'] }
    }).sort({ created_at: 1 });

    const broadcast = new Broadcast({
      title: `📢 Discord Broadcast`,
      message: message.trim(),
      type,
      priority: 'medium',
      target_audience,
      status: 'sent',
      created_by: adminUser._id,
      sent_by: adminUser._id,
      sent_at: new Date(),
      settings: {
        send_to_new_users: false,
        persistent: true,
        dismissible: true
      }
    });

    await broadcast.save();

    const deliveryStats = await socketService.sendBroadcastNotification(broadcast);
    
    broadcast.total_recipients = deliveryStats.total_recipients;
    broadcast.notifications_created = deliveryStats.notifications_created;
    broadcast.delivery_stats = deliveryStats.delivery_stats;
    await broadcast.save();

    await discordHandler.sendSuccess(
      `Broadcast sent successfully! 📡`,
      [
        { name: 'Message', value: message.length > 100 ? message.substring(0, 100) + '...' : message, inline: false },
        { name: 'Audience', value: target_audience, inline: true },
        { name: 'Recipients', value: deliveryStats.total_recipients.toString(), inline: true },
        { name: 'Delivered', value: deliveryStats.delivery_stats.online_delivery.toString(), inline: true }
      ]
    );

    console.log(`📢 DISCORD BROADCAST: Sent to ${deliveryStats.total_recipients} users via Discord by ${req.discordUser.id}`);

    res.json({
      success: true,
      message: 'Broadcast sent successfully',
      data: {
        broadcast_id: broadcast._id,
        delivery_stats: deliveryStats
      }
    });

  } catch (error) {
    console.error('Discord broadcast error:', error);
    await discordHandler.sendError('Failed to send broadcast', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/stats', discordAuth, async (req, res) => {
  try {
    const [userCount, frameCount, reportCount, ticketCount] = await Promise.all([
      User.countDocuments({ ban_status: false }),
      Frame.countDocuments({ visibility: 'public', approval_status: 'approved' }),
      Report.countDocuments({ report_status: 'pending' }),
      Ticket.countDocuments({ status: 'pending' })
    ]);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentUsers, recentFrames] = await Promise.all([
      User.countDocuments({ created_at: { $gte: last24Hours }, ban_status: false }),
      Frame.countDocuments({ created_at: { $gte: last24Hours }, visibility: 'public' })
    ]);

    await discordHandler.sendEmbed(
      '📊 System Statistics',
      'Current platform statistics',
      [
        { name: '👥 Active Users', value: userCount.toString(), inline: true },
        { name: '🖼️ Approved Frames', value: frameCount.toString(), inline: true },
        { name: '📋 Pending Reports', value: reportCount.toString(), inline: true },
        { name: '🎫 Pending Tickets', value: ticketCount.toString(), inline: true },
        { name: '📈 New Users (24h)', value: recentUsers.toString(), inline: true },
        { name: '📈 New Frames (24h)', value: recentFrames.toString(), inline: true }
      ],
      0x2ecc71
    );

    res.json({
      success: true,
      data: {
        users: userCount,
        frames: frameCount,
        reports: reportCount,
        tickets: ticketCount,
        recent: { users: recentUsers, frames: recentFrames }
      }
    });

  } catch (error) {
    console.error('Discord stats command error:', error);
    await discordHandler.sendError('Failed to fetch stats', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/user/:username', [
  param('username').notEmpty().withMessage('Username required')
], discordAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password');

    if (!user) {
      await discordHandler.sendError('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const fields = [
      { name: 'ID', value: user._id.toString(), inline: true },
      { name: 'Username', value: `@${user.username}`, inline: true },
      { name: 'Role', value: user.role, inline: true },
      { name: 'Status', value: user.ban_status ? '🔴 Banned' : '🟢 Active', inline: true },
      { name: 'Email', value: user.email || 'Not provided', inline: true },
      { name: 'Created', value: new Date(user.created_at).toLocaleDateString(), inline: true }
    ];

    if (user.ban_status && user.ban_release_datetime) {
      fields.push({ name: 'Ban Release', value: new Date(user.ban_release_datetime).toLocaleString(), inline: true });
    }

    await discordHandler.sendEmbed(
      `👤 User Details: @${user.username}`,
      user.bio || 'No bio provided',
      fields,
      user.ban_status ? 0xff0000 : 0x00ff00
    );

    res.json({
      success: true,
      data: { user_found: true }
    });

  } catch (error) {
    console.error('Discord user detail error:', error);
    await discordHandler.sendError('Failed to fetch user details', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


router.post('/user/:username/unban', [
  param('username').notEmpty().withMessage('Username required')
], discordAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      await discordHandler.sendError('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.ban_status) {
      await discordHandler.sendError('User is not banned');
      return res.status(400).json({
        success: false,
        message: 'User is not banned'
      });
    }

    user.ban_status = false;
    user.ban_release_datetime = null;
    await user.save();

    await discordHandler.sendSuccess(
      `User unbanned successfully! ✅`,
      [
        { name: 'User', value: `@${user.username}`, inline: true },
        { name: 'Status', value: '🟢 Active', inline: true },
        { name: 'Action', value: 'Ban removed', inline: true }
      ]
    );

    console.log(`📢 DISCORD UNBAN: User ${user.username} unbanned via Discord by ${req.discordUser.id}`);

    res.json({
      success: true,
      message: 'User unbanned successfully',
      data: { username: user.username }
    });

  } catch (error) {
    console.error('Discord user unban error:', error);
    await discordHandler.sendError('Failed to unban user', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


router.post('/user/:username/role', [
  param('username').notEmpty().withMessage('Username required'),
  body('role').isIn(['basic', 'verified_basic', 'verified_premium', 'official', 'developer']).withMessage('Invalid role')
], discordAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      await discordHandler.sendError('User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const oldRole = user.role;
    const { role } = req.body;

    if (oldRole === role) {
      await discordHandler.sendError('User already has this role');
      return res.status(400).json({
        success: false,
        message: 'User already has this role'
      });
    }

    user.role = role;
    await user.save();

    await discordHandler.sendSuccess(
      `User role updated successfully! 🔄`,
      [
        { name: 'User', value: `@${user.username}`, inline: true },
        { name: 'Old Role', value: oldRole, inline: true },
        { name: 'New Role', value: role, inline: true }
      ]
    );

    console.log(`📢 DISCORD ROLE: User ${user.username} role changed from ${oldRole} to ${role} via Discord by ${req.discordUser.id}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        username: user.username,
        old_role: oldRole,
        new_role: role
      }
    });

  } catch (error) {
    console.error('Discord user role update error:', error);
    await discordHandler.sendError('Failed to update user role', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;