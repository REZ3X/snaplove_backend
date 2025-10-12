const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
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
  frame_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frame',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expires_at: {
    type: Date,
    default: null
  },
  livePhoto: {
    type: Boolean,
    default: false
  },
  video_files: [{
    type: String,
    default: []
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

photoSchema.index({ expires_at: 1 });
photoSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('Photo', photoSchema);