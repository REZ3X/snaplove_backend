const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
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
  report_status: {
    type: String,
    enum: ['pending', 'done', 'rejected'],
    default: 'pending'
  },
  admin_response: {
    type: String,
    default: null,
    maxlength: 1000
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});


reportSchema.index({ frame_id: 1 });
reportSchema.index({ user_id: 1 });
reportSchema.index({ report_status: 1 });
reportSchema.index({ created_at: -1 });

module.exports = mongoose.model('Report', reportSchema);