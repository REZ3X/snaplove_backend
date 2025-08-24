const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

class SocketService {
  constructor() {
    this.io = null;
    this.users = new Map();
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.PRODUCTION_FRONTEND_URLS?.split(',').map(url => url.trim()) || []
          : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -google_id');

        if (!user) {
          return next(new Error('User not found'));
        }

        if (user.ban_status) {
          return next(new Error('User is banned'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('📡 Socket.IO service initialized');
  }

  handleConnection(socket) {
    const userId = socket.userId;

    this.users.set(userId, socket.id);

    console.log(`📱 User ${socket.user.username} connected (${socket.id})`);

    socket.join(`user_${userId}`);

    this.sendUnreadCount(userId);

    socket.on('mark_notification_read', async (notificationId) => {
      try {
        await this.markNotificationAsRead(userId, notificationId);
        this.sendUnreadCount(userId);
      } catch (error) {
        console.error('Mark notification read error:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    socket.on('mark_all_read', async () => {
      try {
        await this.markAllNotificationsAsRead(userId);
        this.sendUnreadCount(userId);
      } catch (error) {
        console.error('Mark all notifications read error:', error);
        socket.emit('error', { message: 'Failed to mark all notifications as read' });
      }
    });

    socket.on('get_notifications', async (data = {}) => {
      try {
        const { page = 1, limit = 20 } = data;
        const notifications = await this.getUserNotifications(userId, page, limit);
        socket.emit('notifications_list', notifications);
      } catch (error) {
        console.error('Get notifications error:', error);
        socket.emit('error', { message: 'Failed to get notifications' });
      }
    });

    socket.on('disconnect', () => {
      this.users.delete(userId);
      console.log(`📱 User ${socket.user.username} disconnected (${socket.id})`);
    });
  }

  async sendNotificationToUser(recipientId, notification) {
    try {
      const savedNotification = await this.createNotification(notification);

      const socketId = this.users.get(recipientId.toString());
      if (socketId) {
        this.io.to(`user_${recipientId}`).emit('new_notification', {
          id: savedNotification._id,
          type: savedNotification.type,
          title: savedNotification.title,
          message: savedNotification.message,
          data: savedNotification.data,
          sender: savedNotification.sender_id,
          is_read: savedNotification.is_read,
          created_at: savedNotification.created_at
        });

        this.sendUnreadCount(recipientId.toString());
      }

      return savedNotification;
    } catch (error) {
      console.error('Send notification error:', error);
      throw error;
    }
  }

  async createNotification(notificationData) {
    const notification = new Notification(notificationData);
    await notification.save();

    await notification.populate([
      { path: 'sender_id', select: 'name username image_profile role' },
      { path: 'data.frame_id', select: 'title thumbnail' }
    ]);

    return notification;
  }


  async markNotificationAsRead(userId, notificationId) {
    await Notification.findOneAndUpdate(
      { _id: notificationId, recipient_id: userId },
      {
        is_read: true,
        read_at: new Date()
      }
    );
  }

  async markAllNotificationsAsRead(userId) {
    await Notification.updateMany(
      { recipient_id: userId, is_read: false },
      {
        is_read: true,
        read_at: new Date()
      }
    );
  }

  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient_id: userId })
      .populate('sender_id', 'name username image_profile role')
      .populate('data.frame_id', 'title thumbnail')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({ recipient_id: userId });
    const unreadCount = await Notification.countDocuments({
      recipient_id: userId,
      is_read: false
    });

    return {
      notifications: notifications.map(notif => ({
        id: notif._id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        data: notif.data,
        sender: notif.sender_id,
        is_read: notif.is_read,
        read_at: notif.read_at,
        created_at: notif.created_at
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
        has_next_page: page < Math.ceil(total / limit),
        has_prev_page: page > 1
      },
      unread_count: unreadCount
    };
  }

  async sendUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient_id: userId,
        is_read: false
      });

      this.io.to(`user_${userId}`).emit('unread_count', { count });
    } catch (error) {
      console.error('Send unread count error:', error);
    }
  }

  async sendFrameLikeNotification(frameOwnerId, likerId, frameData) {
    const notification = {
      recipient_id: frameOwnerId,
      sender_id: likerId,
      type: 'frame_like',
      title: '❤️ Frame Liked!',
      message: `Someone liked your frame "${frameData.title}"`,
      data: {
        frame_id: frameData.id,
        frame_title: frameData.title,
        frame_thumbnail: frameData.thumbnail,
        additional_info: {
          like_count: frameData.total_likes
        }
      }
    };

    return await this.sendNotificationToUser(frameOwnerId, notification);
  }

  async sendFollowNotification(followedUserId, followerId, followerData) {
    const notification = {
      recipient_id: followedUserId,
      sender_id: followerId,
      type: 'user_follow',
      title: '👤 New Follower!',
      message: `${followerData.follower_name} (@${followerData.follower_username}) started following you`,
      data: {
        follower_id: followerId,
        follower_name: followerData.follower_name,
        follower_username: followerData.follower_username,
        follower_image: followerData.follower_image,
        additional_info: {
          action: 'follow'
        }
      }
    };

    return await this.sendNotificationToUser(followedUserId, notification);
  }

  async sendFrameUploadNotification(frameOwnerId, frameData) {
    try {
      const Follow = require('../models/Follow');

      const followers = await Follow.find({
        following_id: frameOwnerId,
        status: 'active'
      }).populate('follower_id', 'ban_status');

      const activeFollowers = followers.filter(follow =>
        !follow.follower_id.ban_status
      );

      const notificationPromises = activeFollowers.map(async (follow) => {
        const notification = {
          recipient_id: follow.follower_id._id,
          sender_id: frameOwnerId,
          type: 'frame_upload',
          title: '🖼️ New Frame!',
          message: `${frameData.owner_name} uploaded a new frame "${frameData.title}"`,
          data: {
            frame_id: frameData.id,
            frame_title: frameData.title,
            frame_thumbnail: frameData.thumbnail,
            owner_id: frameOwnerId,
            owner_name: frameData.owner_name,
            owner_username: frameData.owner_username,
            additional_info: {
              action: 'frame_upload',
              layout_type: frameData.layout_type
            }
          }
        };

        return await this.sendNotificationToUser(follow.follower_id._id, notification);
      });

      await Promise.allSettled(notificationPromises);

      console.log(`📡 Sent frame upload notifications to ${activeFollowers.length} followers`);

      return activeFollowers.length;
    } catch (error) {
      console.error('Send frame upload notifications error:', error);
      throw error;
    }
  }

  async sendFrameUseNotification(frameOwnerId, userId, frameData) {
    const notification = {
      recipient_id: frameOwnerId,
      sender_id: userId,
      type: 'frame_use',
      title: '📸 Frame Used!',
      message: `Someone used your frame "${frameData.title}" to take a photo`,
      data: {
        frame_id: frameData.id,
        frame_title: frameData.title,
        frame_thumbnail: frameData.thumbnail,
        additional_info: {
          use_count: frameData.total_uses
        }
      }
    };

    return await this.sendNotificationToUser(frameOwnerId, notification);
  }

  async sendFrameApprovalNotification(frameOwnerId, frameData, approvalStatus, rejectionReason = null) {
    const isApproved = approvalStatus === 'approved';

    const notification = {
      recipient_id: frameOwnerId,
      sender_id: frameOwnerId,
      type: isApproved ? 'frame_approved' : 'frame_rejected',
      title: isApproved ? '✅ Frame Approved!' : '❌ Frame Rejected',
      message: isApproved
        ? `Your frame "${frameData.title}" has been approved and is now public!`
        : `Your frame "${frameData.title}" was rejected. ${rejectionReason || 'Please review and resubmit.'}`,
      data: {
        frame_id: frameData.id,
        frame_title: frameData.title,
        frame_thumbnail: frameData.thumbnail,
        additional_info: {
          approval_status: approvalStatus,
          rejection_reason: rejectionReason
        }
      }
    };

    return await this.sendNotificationToUser(frameOwnerId, notification);
  }

  getConnectedUsersCount() {
    return this.users.size;
  }

  isUserOnline(userId) {
    return this.users.has(userId.toString());
  }
}

module.exports = new SocketService();