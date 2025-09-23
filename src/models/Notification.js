const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['frame_like', 'frame_use', 'frame_approved', 'frame_rejected', 'user_follow', 'frame_upload', 'system', 'birthday', 'broadcast'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    frame_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Frame'
    },
    frame_title: String,
    frame_thumbnail: String,
    follower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    follower_name: String,
    follower_username: String,
    follower_image: String,
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    owner_name: String,
    owner_username: String,
    owner_image: String,
    birthday_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    birthday_user_name: String,
    birthday_user_username: String,
    birthday_user_age: Number,

    broadcast_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Broadcast'
    },
    broadcast_type: String,
    broadcast_priority: String,
    action_url: String,
    custom_icon: String,
    custom_color: String,

    additional_info: mongoose.Schema.Types.Mixed
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date,
    default: null
  },

  is_dismissible: {
    type: Boolean,
    default: true
  },
  expires_at: {
    type: Date,
    default: null
  }

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

notificationSchema.index({ recipient_id: 1, created_at: -1 });
notificationSchema.index({ recipient_id: 1, is_read: 1 });
notificationSchema.index({ recipient_id: 1, type: 1 });
notificationSchema.index({ expires_at: 1 });

module.exports = mongoose.model('Notification', notificationSchema);