const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
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
    maxlength: 2000
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    type: String,
    default: []
  }],
  type: {
    type: String,
    enum: ['suggestion', 'critics', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  admin_response: {
    type: String,
    default: null,
    maxlength: 2000
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

ticketSchema.pre('save', function(next) {
  const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(this.status)) {
    const error = new Error(`Invalid status: ${this.status}. Must be one of: ${validStatuses.join(', ')}`);
    return next(error);
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (!validPriorities.includes(this.priority)) {
    const error = new Error(`Invalid priority: ${this.priority}. Must be one of: ${validPriorities.join(', ')}`);
    return next(error);
  }

  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);