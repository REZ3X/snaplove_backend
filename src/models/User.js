const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  image_profile: {
    type: String,
    default: null
  },
  custom_profile_image: {
    type: String,
    default: null
  },
  use_google_profile: {
    type: Boolean,
    default: true
  },
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['basic', 'verified_basic', 'verified_premium', 'official', 'developer'],
    default: 'basic'
  },
  bio: {
    type: String,
    default: ''
  },
  birthdate: {
    type: Date,
    default: null
  },
  ban_status: {
    type: Boolean,
    default: false
  },
  ban_release_datetime: {
    type: Date,
    default: null
  },
  google_id: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('User', userSchema);