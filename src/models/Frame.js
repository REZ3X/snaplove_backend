const mongoose = require('mongoose');

const frameSchema = new mongoose.Schema({
  images: [{
    type: String,
    required: true
  }],
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

frameSchema.virtual('total_likes').get(function() {
  return this.like_count ? this.like_count.length : 0;
});

frameSchema.virtual('total_uses').get(function() {
  return this.use_count ? this.use_count.length : 0;
});

frameSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Frame', frameSchema);