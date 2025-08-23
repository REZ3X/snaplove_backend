const getRoleLimits = (role) => {
  const policies = {
    basic: {
      public_frames: 3,
      photo_ttl_days: 3,
      can_unlimited_private: true
    },
    verified_basic: {
      public_frames: 20,
      photo_ttl_days: 7,
      can_unlimited_private: true
    },
    verified_premium: {
      public_frames: -1,
      photo_ttl_days: -1,
      can_unlimited_private: true
    },
    official: {
      public_frames: -1,
      photo_ttl_days: -1,
      can_unlimited_private: true
    },
    developer: {
      public_frames: -1,
      photo_ttl_days: -1,
      can_unlimited_private: true
    }
  };

  return policies[role] || policies.basic;
};

const calculatePhotoExpiry = (role) => {
  const limits = getRoleLimits(role);
  if (limits.photo_ttl_days === -1) {
    return null;
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + limits.photo_ttl_days);
  return expiryDate;
};

const canCreatePublicFrame = async (userId) => {
  const User = require('../models/User');
  const Frame = require('../models/Frame');

  const user = await User.findById(userId);
  if (!user) return { canCreate: false, reason: 'User not found' };

  const limits = getRoleLimits(user.role);

  if (limits.public_frames === -1) {
    return { canCreate: true, limit: 'unlimited' };
  }

  const publicFrameCount = await Frame.countDocuments({
    user_id: userId,
    visibility: 'public'
  });

  if (publicFrameCount >= limits.public_frames) {
    return {
      canCreate: false,
      reason: `You've reached your limit of ${limits.public_frames} public frames`,
      current: publicFrameCount,
      limit: limits.public_frames
    };
  }

  return {
    canCreate: true,
    current: publicFrameCount,
    limit: limits.public_frames
  };
};

module.exports = {
  getRoleLimits,
  calculatePhotoExpiry,
  canCreatePublicFrame
};