const getDisplayProfileImage = (user, req) => {
  if (user.use_google_profile !== false && user.image_profile) {
    return user.image_profile; 
  } else if (user.custom_profile_image) {
    return req.protocol + '://' + req.get('host') + '/' + user.custom_profile_image;
  } else {
    return user.image_profile;
  }
};

module.exports = { getDisplayProfileImage };