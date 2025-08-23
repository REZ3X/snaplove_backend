const mongoose = require('mongoose');

const frameSchema = new mongoose.Schema({
  images: [{
    type: String,
    required: true
  }],
  thumbnail: {
    type: String,
    default: null
  },
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
  like_count: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
  use_count: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
  layout_type: {
    type: String,
    enum: ['2x1', '3x1', '4x1'],
    required: true
  },
  official_status: {
    type: Boolean,
    default: false
  },
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private'
  },

  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default() {
      return this.official_status ? 'approved' : 'pending';
    }
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approved_at: {
    type: Date,
    default: null
  },
  rejection_reason: {
    type: String,
    default: null,
    maxlength: 500
  },
  tag_label: [{
    type: String,
    trim: true
  }],
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

frameSchema.virtual('total_likes').get(function () {
  return this.like_count ? this.like_count.length : 0;
});

frameSchema.virtual('total_uses').get(function () {
  return this.use_count ? this.use_count.length : 0;
});


frameSchema.virtual('is_public_visible').get(function () {
  return this.visibility === 'public' && this.approval_status === 'approved';
});

frameSchema.set('toJSON', { virtuals: true });


frameSchema.index({ visibility: 1, approval_status: 1 });
frameSchema.index({ approval_status: 1, created_at: -1 });

module.exports = mongoose.model('Frame', frameSchema);