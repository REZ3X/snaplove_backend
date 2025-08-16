const mongoose = require('mongoose');

const photoPostSchema = new mongoose.Schema({
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
  tag_label: [{
    type: String,
    trim: true
  }],
  posted: {
    type: Boolean,
    default: false
  },
  template_frame_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frame',
    default: null
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

photoPostSchema.virtual('total_likes').get(function() {
  return this.like_count ? this.like_count.length : 0;
});

photoPostSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('PhotoPost', photoPostSchema);