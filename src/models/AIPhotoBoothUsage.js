const mongoose = require('mongoose');

const aiPhotoboothUsageSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  count: {
    type: Number,
    default: 0
  },
  month: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  last_used_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

aiPhotoboothUsageSchema.index({ user_id: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('AIPhotoboothUsage', aiPhotoboothUsageSchema);