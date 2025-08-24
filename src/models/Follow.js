const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  follower_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

followSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

followSchema.index({ follower_id: 1, status: 1 });
followSchema.index({ following_id: 1, status: 1 });
followSchema.index({ created_at: -1 });

followSchema.pre('save', function (next) {
  if (this.follower_id.equals(this.following_id)) {
    const error = new Error('Users cannot follow themselves');
    return next(error);
  }
  next();
});

module.exports = mongoose.model('Follow', followSchema);