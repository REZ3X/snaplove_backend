const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['emoji', 'text', 'image'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  size: {
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  rotation: {
    type: Number,
    default: 0
  },
  added_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

const photoCollabSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  desc: {
    type: String,
    default: '',
    maxlength: 500
  },
  frame_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frame',
    required: true
  },
  layout_type: {
    type: String,
    enum: ['2x1', '3x1', '4x1'],
    required: true
  },

  inviter: {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    photo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
      required: true
    }
  },
  
  receiver: {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    photo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
      required: true
    }
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed'],
    default: 'pending'
  },

  merged_images: [{
    type: String 
  }],

  stickers: [stickerSchema],

  invitation: {
    message: {
      type: String,
      maxlength: 200,
      default: ''
    },
    sent_at: {
      type: Date,
      default: Date.now
    },
    responded_at: {
      type: Date,
      default: null
    }
  },

  expires_at: {
    type: Date,
    required: true
  },

  completed_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

photoCollabSchema.index({ expires_at: 1 });
photoCollabSchema.index({ 'inviter.user_id': 1, created_at: -1 });
photoCollabSchema.index({ 'receiver.user_id': 1, created_at: -1 });
photoCollabSchema.index({ status: 1, created_at: -1 });

module.exports = mongoose.model('PhotoCollab', photoCollabSchema);