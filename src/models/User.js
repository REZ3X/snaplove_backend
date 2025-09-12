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
  birthdate_changed: {
    type: Boolean,
    default: false
  },
  birthdate_changed_at: {
    type: Date,
    default: null
  },
  last_birthday_notification: {
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

userSchema.virtual('birthday_badge').get(function() {
  if (!this.birthdate) return null;
  
  const today = new Date();
  const birthday = new Date(this.birthdate);

  const isBirthday = today.getMonth() === birthday.getMonth() && 
                     today.getDate() === birthday.getDate();
  
  if (isBirthday) {
    let age = today.getFullYear() - birthday.getFullYear();
    if (today.getMonth() < birthday.getMonth() || 
        (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate())) {
      age--;
    }
    
    return {
      is_birthday: true,
      age,
      expires_at: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), 
      badge_text: `🎂 ${age} Today!`
    };
  }
  
  return {
    is_birthday: false,
    age: null,
    expires_at: null,
    badge_text: null
  };
});

module.exports = mongoose.model('User', userSchema);