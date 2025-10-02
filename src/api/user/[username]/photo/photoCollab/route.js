const express = require('express');
const { param, body, query, validationResult } = require('express-validator');
const PhotoCollab = require('../../../../../models/PhotoCollab');
const Photo = require('../../../../../models/Photo');
const User = require('../../../../../models/User');
const _Frame = require('../../../../../models/Frame');
const { authenticateToken, checkBanStatus } = require('../../../../../middleware/middleware');
const { calculatePhotoExpiry } = require('../../../../../utils/RolePolicy');
const { getDisplayProfileImage } = require('../../../../../utils/profileImageHelper');
const socketService = require('../../../../../services/socketService');
const _geminiAI = require('../../../../../utils/GeminiAIImage');
const imageHandler = require('../../../../../utils/LocalImageHandler');
const path = require('path');
const sharp = require('sharp');

const router = express.Router();

router.post('/:username/photo/photoCollab/invite', [
  param('username').notEmpty().withMessage('Username is required'),
  body('receiver_username').notEmpty().withMessage('Receiver username is required'),
  body('photo_id').isMongoId().withMessage('Valid photo ID is required'),
  body('message').optional().isLength({ max: 200 }).withMessage('Message must be max 200 characters')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { receiver_username, photo_id, message } = req.body;

    const inviterUser = await User.findOne({ username: req.params.username });
    if (!inviterUser || req.user.userId !== inviterUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const receiverUser = await User.findOne({ username: receiver_username });
    if (!receiverUser) {
      return res.status(404).json({
        success: false,
        message: 'Receiver user not found'
      });
    }

    if (inviterUser._id.toString() === receiverUser._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot collaborate with yourself'
      });
    }

    const inviterPhoto = await Photo.findOne({
      _id: photo_id,
      user_id: inviterUser._id
    }).populate('frame_id', 'layout_type title');

    if (!inviterPhoto) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found or access denied'
      });
    }

    if (inviterPhoto.expires_at && new Date() > inviterPhoto.expires_at) {
      return res.status(400).json({
        success: false,
        message: 'Photo has expired and cannot be used for collaboration'
      });
    }

    const existingInvitation = await PhotoCollab.findOne({
      'inviter.user_id': inviterUser._id,
      'receiver.user_id': receiverUser._id,
      'inviter.photo_id': photo_id,
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending collaboration invitation with this user for this photo'
      });
    }

    const expiryDate = calculatePhotoExpiry(inviterUser.role);
    
    const collaboration = new PhotoCollab({
      title: `Collab: ${inviterPhoto.title}`,
      desc: `Collaboration between ${inviterUser.username} and ${receiverUser.username}`,
      frame_id: inviterPhoto.frame_id._id,
      layout_type: inviterPhoto.frame_id.layout_type,
      inviter: {
        user_id: inviterUser._id,
        photo_id
      },
      receiver: {
        user_id: receiverUser._id,
        photo_id: null       },
      invitation: {
        message: message || '',
        sent_at: new Date()
      },
      expires_at: expiryDate,
      status: 'pending'
    });

    await collaboration.save();
    await collaboration.populate([
      { path: 'inviter.user_id', select: 'name username image_profile' },
      { path: 'receiver.user_id', select: 'name username image_profile' },
      { path: 'frame_id', select: 'title layout_type thumbnail' }
    ]);

    try {
      await socketService.sendNotificationToUser(receiverUser._id, {
        type: 'photo_collab_invite',
        title: '📸 Collaboration Invitation!',
        message: `${inviterUser.username} invited you to collaborate on a photo`,
        data: {
          collaboration_id: collaboration._id,
          inviter: {
            id: inviterUser._id,
            name: inviterUser.name,
            username: inviterUser.username,
            image_profile: getDisplayProfileImage(inviterUser, req)
          },
          photo_preview: inviterPhoto.images[0] ? req.protocol + '://' + req.get('host') + '/' + inviterPhoto.images[0] : null,
          frame: {
            title: inviterPhoto.frame_id.title,
            layout_type: inviterPhoto.frame_id.layout_type
          },
          message: message || '',
          expires_at: expiryDate
        }
      });
    } catch (notifError) {
      console.error('Failed to send collaboration notification:', notifError);
    }

    console.log(`📸 COLLAB INVITE: ${inviterUser.username} invited ${receiverUser.username} for photo collaboration`);

    res.status(201).json({
      success: true,
      message: 'Collaboration invitation sent successfully',
      data: {
        collaboration: {
          id: collaboration._id,
          title: collaboration.title,
          status: collaboration.status,
          layout_type: collaboration.layout_type,
          inviter: {
            id: collaboration.inviter.user_id._id,
            name: collaboration.inviter.user_id.name,
            username: collaboration.inviter.user_id.username,
            image_profile: getDisplayProfileImage(collaboration.inviter.user_id, req)
          },
          receiver: {
            id: collaboration.receiver.user_id._id,
            name: collaboration.receiver.user_id.name,
            username: collaboration.receiver.user_id.username,
            image_profile: getDisplayProfileImage(collaboration.receiver.user_id, req)
          },
          frame: {
            id: collaboration.frame_id._id,
            title: collaboration.frame_id.title,
            layout_type: collaboration.frame_id.layout_type
          },
          invitation: collaboration.invitation,
          expires_at: collaboration.expires_at,
          created_at: collaboration.created_at
        }
      }
    });

  } catch (error) {
    console.error('Send collaboration invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/:username/photo/photoCollab/invitations', [
  param('username').notEmpty().withMessage('Username is required'),
  query('status').optional().isIn(['pending', 'accepted', 'rejected']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'pending';

    const filter = {
      'receiver.user_id': targetUser._id,
      ...(status && { status })
    };

    const [invitations, total] = await Promise.all([
      PhotoCollab.find(filter)
        .populate('inviter.user_id', 'name username image_profile')
        .populate('inviter.photo_id', 'images title')
        .populate('frame_id', 'title layout_type thumbnail')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      PhotoCollab.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedInvitations = invitations.map(invitation => ({
      id: invitation._id,
      title: invitation.title,
      status: invitation.status,
      layout_type: invitation.layout_type,
      inviter: {
        id: invitation.inviter.user_id._id,
        name: invitation.inviter.user_id.name,
        username: invitation.inviter.user_id.username,
        image_profile: getDisplayProfileImage(invitation.inviter.user_id, req)
      },
      photo_preview: invitation.inviter.photo_id?.images?.[0] ? 
        req.protocol + '://' + req.get('host') + '/' + invitation.inviter.photo_id.images[0] : null,
      frame: {
        id: invitation.frame_id._id,
        title: invitation.frame_id.title,
        layout_type: invitation.frame_id.layout_type,
        thumbnail: invitation.frame_id.thumbnail ? 
          req.protocol + '://' + req.get('host') + '/' + invitation.frame_id.thumbnail : null
      },
      invitation: invitation.invitation,
      expires_at: invitation.expires_at,
      created_at: invitation.created_at
    }));

    res.json({
      success: true,
      data: {
        invitations: formattedInvitations,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get collaboration invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:username/photo/photoCollab/:collaborationId/respond', [
  param('username').notEmpty().withMessage('Username is required'),
  param('collaborationId').isMongoId().withMessage('Valid collaboration ID is required'),
  body('action').isIn(['accept', 'reject']).withMessage('Action must be accept or reject'),
  body('photo_id').optional().isMongoId().withMessage('Valid photo ID is required when accepting')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { action, photo_id } = req.body;

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const collaboration = await PhotoCollab.findOne({
      _id: req.params.collaborationId,
      'receiver.user_id': targetUser._id,
      status: 'pending'
    }).populate([
      { path: 'inviter.user_id', select: 'name username image_profile' },
      { path: 'inviter.photo_id', select: 'images frame_id' },
      { path: 'frame_id', select: 'title layout_type' }
    ]);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration invitation not found or already responded'
      });
    }

    if (new Date() > collaboration.expires_at) {
      return res.status(400).json({
        success: false,
        message: 'Collaboration invitation has expired'
      });
    }

    if (action === 'accept') {
      if (!photo_id) {
        return res.status(400).json({
          success: false,
          message: 'Photo ID is required when accepting collaboration'
        });
      }

      const receiverPhoto = await Photo.findOne({
        _id: photo_id,
        user_id: targetUser._id
      }).populate('frame_id', 'layout_type');

      if (!receiverPhoto) {
        return res.status(404).json({
          success: false,
          message: 'Your selected photo not found'
        });
      }

      if (receiverPhoto.expires_at && new Date() > receiverPhoto.expires_at) {
        return res.status(400).json({
          success: false,
          message: 'Your selected photo has expired'
        });
      }

      if (receiverPhoto.frame_id.layout_type !== collaboration.layout_type) {
        return res.status(400).json({
          success: false,
          message: `Frame layout mismatch. Required: ${collaboration.layout_type}, your photo: ${receiverPhoto.frame_id.layout_type}`
        });
      }

      collaboration.receiver.photo_id = photo_id;
      collaboration.status = 'accepted';
      collaboration.invitation.responded_at = new Date();

      const mergedImages = await createCollaborationMerge(collaboration, receiverPhoto);
      collaboration.merged_images = mergedImages;

      await collaboration.save();

      try {
        await socketService.sendNotificationToUser(collaboration.inviter.user_id._id, {
          type: 'photo_collab_accepted',
          title: '🎉 Collaboration Accepted!',
          message: `${targetUser.username} accepted your collaboration invitation`,
          data: {
            collaboration_id: collaboration._id,
            receiver: {
              id: targetUser._id,
              name: targetUser.name,
              username: targetUser.username,
              image_profile: getDisplayProfileImage(targetUser, req)
            }
          }
        });
      } catch (notifError) {
        console.error('Failed to send acceptance notification:', notifError);
      }

      console.log(`📸 COLLAB ACCEPTED: ${targetUser.username} accepted collaboration from ${collaboration.inviter.user_id.username}`);

    } else {

      collaboration.status = 'rejected';
      collaboration.invitation.responded_at = new Date();
      await collaboration.save();

      try {
        await socketService.sendNotificationToUser(collaboration.inviter.user_id._id, {
          type: 'photo_collab_rejected',
          title: '😔 Collaboration Declined',
          message: `${targetUser.username} declined your collaboration invitation`,
          data: {
            collaboration_id: collaboration._id,
            receiver: {
              id: targetUser._id,
              name: targetUser.name,
              username: targetUser.username
            }
          }
        });
      } catch (notifError) {
        console.error('Failed to send rejection notification:', notifError);
      }

      console.log(`📸 COLLAB REJECTED: ${targetUser.username} rejected collaboration from ${collaboration.inviter.user_id.username}`);
    }

    res.json({
      success: true,
      message: `Collaboration ${action}ed successfully`,
      data: {
        collaboration: {
          id: collaboration._id,
          status: collaboration.status,
          responded_at: collaboration.invitation.responded_at,
          ...(action === 'accept' && {
            merged_images: collaboration.merged_images.map(img => 
              req.protocol + '://' + req.get('host') + '/' + img
            )
          })
        }
      }
    });

  } catch (error) {
    console.error('Respond to collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/:username/photo/photoCollab', [
  param('username').notEmpty().withMessage('Username is required'),
  query('type').optional().isIn(['sent', 'received', 'all']).withMessage('Type must be sent, received, or all'),
  query('status').optional().isIn(['pending', 'accepted', 'rejected', 'completed']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type || 'all';
    const status = req.query.status;

    const filter = {};

    if (type === 'sent') {
      filter['inviter.user_id'] = targetUser._id;
    } else if (type === 'received') {
      filter['receiver.user_id'] = targetUser._id;
    } else {
      filter.$or = [
        { 'inviter.user_id': targetUser._id },
        { 'receiver.user_id': targetUser._id }
      ];
    }

    if (status) {
      filter.status = status;
    }

    const [collaborations, total] = await Promise.all([
      PhotoCollab.find(filter)
        .populate('inviter.user_id', 'name username image_profile')
        .populate('receiver.user_id', 'name username image_profile')
        .populate('frame_id', 'title layout_type thumbnail')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      PhotoCollab.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    const formattedCollaborations = collaborations.map(collab => ({
      id: collab._id,
      title: collab.title,
      desc: collab.desc,
      status: collab.status,
      layout_type: collab.layout_type,
      inviter: {
        id: collab.inviter.user_id._id,
        name: collab.inviter.user_id.name,
        username: collab.inviter.user_id.username,
        image_profile: getDisplayProfileImage(collab.inviter.user_id, req)
      },
      receiver: collab.receiver.user_id ? {
        id: collab.receiver.user_id._id,
        name: collab.receiver.user_id.name,
        username: collab.receiver.user_id.username,
        image_profile: getDisplayProfileImage(collab.receiver.user_id, req)
      } : null,
      frame: {
        id: collab.frame_id._id,
        title: collab.frame_id.title,
        layout_type: collab.frame_id.layout_type,
        thumbnail: collab.frame_id.thumbnail ? 
          req.protocol + '://' + req.get('host') + '/' + collab.frame_id.thumbnail : null
      },
      merged_images: collab.merged_images?.map(img => 
        req.protocol + '://' + req.get('host') + '/' + img
      ) || [],
      stickers_count: collab.stickers?.length || 0,
      invitation: collab.invitation,
      expires_at: collab.expires_at,
      completed_at: collab.completed_at,
      created_at: collab.created_at,
      updated_at: collab.updated_at,
      user_role: collab.inviter.user_id._id.toString() === targetUser._id.toString() ? 'inviter' : 'receiver'
    }));

    res.json({
      success: true,
      data: {
        collaborations: formattedCollaborations,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: total,
          items_per_page: limit,
          has_next_page: page < totalPages,
          has_prev_page: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get collaborations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/:username/photo/photoCollab/:collaborationId', [
  param('username').notEmpty().withMessage('Username is required'),
  param('collaborationId').isMongoId().withMessage('Valid collaboration ID is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const collaboration = await PhotoCollab.findOne({
      _id: req.params.collaborationId,
      $or: [
        { 'inviter.user_id': targetUser._id },
        { 'receiver.user_id': targetUser._id }
      ]
    })
      .populate('inviter.user_id', 'name username image_profile')
      .populate('receiver.user_id', 'name username image_profile')
      .populate('inviter.photo_id', 'images title')
      .populate('receiver.photo_id', 'images title')
      .populate('frame_id', 'title layout_type thumbnail')
      .populate('stickers.added_by', 'name username');

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found'
      });
    }

    const formattedCollab = {
      id: collaboration._id,
      title: collaboration.title,
      desc: collaboration.desc,
      status: collaboration.status,
      layout_type: collaboration.layout_type,
      inviter: {
        id: collaboration.inviter.user_id._id,
        name: collaboration.inviter.user_id.name,
        username: collaboration.inviter.user_id.username,
        image_profile: getDisplayProfileImage(collaboration.inviter.user_id, req),
        photo: collaboration.inviter.photo_id ? {
          id: collaboration.inviter.photo_id._id,
          title: collaboration.inviter.photo_id.title,
          images: collaboration.inviter.photo_id.images.map(img => 
            req.protocol + '://' + req.get('host') + '/' + img
          )
        } : null
      },
      receiver: collaboration.receiver.user_id ? {
        id: collaboration.receiver.user_id._id,
        name: collaboration.receiver.user_id.name,
        username: collaboration.receiver.user_id.username,
        image_profile: getDisplayProfileImage(collaboration.receiver.user_id, req),
        photo: collaboration.receiver.photo_id ? {
          id: collaboration.receiver.photo_id._id,
          title: collaboration.receiver.photo_id.title,
          images: collaboration.receiver.photo_id.images.map(img => 
            req.protocol + '://' + req.get('host') + '/' + img
          )
        } : null
      } : null,
      frame: {
        id: collaboration.frame_id._id,
        title: collaboration.frame_id.title,
        layout_type: collaboration.frame_id.layout_type,
        thumbnail: collaboration.frame_id.thumbnail ? 
          req.protocol + '://' + req.get('host') + '/' + collaboration.frame_id.thumbnail : null
      },
      merged_images: collaboration.merged_images?.map(img => 
        req.protocol + '://' + req.get('host') + '/' + img
      ) || [],
      stickers: collaboration.stickers?.map(sticker => ({
        id: sticker.id,
        type: sticker.type,
        content: sticker.content,
        position: sticker.position,
        size: sticker.size,
        rotation: sticker.rotation,
        added_by: {
          id: sticker.added_by._id,
          name: sticker.added_by.name,
          username: sticker.added_by.username
        },
        created_at: sticker.created_at
      })) || [],
      invitation: collaboration.invitation,
      expires_at: collaboration.expires_at,
      completed_at: collaboration.completed_at,
      created_at: collaboration.created_at,
      updated_at: collaboration.updated_at,
      user_role: collaboration.inviter.user_id._id.toString() === targetUser._id.toString() ? 'inviter' : 'receiver',
      can_edit: ['accepted', 'completed'].includes(collaboration.status)
    };

    res.json({
      success: true,
      data: {
        collaboration: formattedCollab
      }
    });

  } catch (error) {
    console.error('Get collaboration details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/:username/photo/photoCollab/:collaborationId/sticker', [
  param('username').notEmpty().withMessage('Username is required'),
  param('collaborationId').isMongoId().withMessage('Valid collaboration ID is required'),
  body('type').isIn(['emoji', 'text', 'image']).withMessage('Sticker type must be emoji, text, or image'),
  body('content').notEmpty().withMessage('Sticker content is required'),
  body('position.x').isNumeric().withMessage('Position X must be a number'),
  body('position.y').isNumeric().withMessage('Position Y must be a number'),
  body('size.width').isNumeric().withMessage('Size width must be a number'),
  body('size.height').isNumeric().withMessage('Size height must be a number'),
  body('rotation').optional().isNumeric().withMessage('Rotation must be a number')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const collaboration = await PhotoCollab.findOne({
      _id: req.params.collaborationId,
      $or: [
        { 'inviter.user_id': targetUser._id },
        { 'receiver.user_id': targetUser._id }
      ],
      status: { $in: ['accepted', 'completed'] }
    });

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found or not editable'
      });
    }

    const { type, content, position, size, rotation } = req.body;
    
    const newSticker = {
      id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      position,
      size,
      rotation: rotation || 0,
      added_by: targetUser._id,
      created_at: new Date()
    };

    collaboration.stickers.push(newSticker);
    await collaboration.save();

    const otherUserId = collaboration.inviter.user_id._id.toString() === targetUser._id.toString() 
      ? collaboration.receiver.user_id._id 
      : collaboration.inviter.user_id._id;

    try {
      await socketService.sendNotificationToUser(otherUserId, {
        type: 'photo_collab_sticker_added',
        title: '🎨 Sticker Added!',
        message: `${targetUser.username} added a sticker to your collaboration`,
        data: {
          collaboration_id: collaboration._id,
          sticker: newSticker,
          added_by: {
            id: targetUser._id,
            username: targetUser.username
          }
        }
      });
    } catch (notifError) {
      console.error('Failed to send sticker notification:', notifError);
    }

    console.log(`🎨 COLLAB STICKER: ${targetUser.username} added sticker to collaboration ${collaboration._id}`);

    res.status(201).json({
      success: true,
      message: 'Sticker added successfully',
      data: {
        sticker: {
          ...newSticker,
          added_by: {
            id: targetUser._id,
            name: targetUser.name,
            username: targetUser.username
          }
        }
      }
    });

  } catch (error) {
    console.error('Add sticker error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.delete('/:username/photo/photoCollab/:collaborationId/sticker/:stickerId', [
  param('username').notEmpty().withMessage('Username is required'),
  param('collaborationId').isMongoId().withMessage('Valid collaboration ID is required'),
  param('stickerId').notEmpty().withMessage('Sticker ID is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const collaboration = await PhotoCollab.findOne({
      _id: req.params.collaborationId,
      $or: [
        { 'inviter.user_id': targetUser._id },
        { 'receiver.user_id': targetUser._id }
      ],
      status: { $in: ['accepted', 'completed'] }
    });

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found or not editable'
      });
    }

    const stickerIndex = collaboration.stickers.findIndex(s => s.id === req.params.stickerId);
    if (stickerIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Sticker not found'
      });
    }

    const sticker = collaboration.stickers[stickerIndex];
    if (sticker.added_by.toString() !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only remove stickers you added'
      });
    }

    collaboration.stickers.splice(stickerIndex, 1);
    await collaboration.save();

    console.log(`🗑️ COLLAB STICKER REMOVED: ${targetUser.username} removed sticker from collaboration ${collaboration._id}`);

    res.json({
      success: true,
      message: 'Sticker removed successfully'
    });

  } catch (error) {
    console.error('Remove sticker error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:username/photo/photoCollab/:collaborationId/complete', [
  param('username').notEmpty().withMessage('Username is required'),
  param('collaborationId').isMongoId().withMessage('Valid collaboration ID is required')
], authenticateToken, checkBanStatus, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser || req.user.userId !== targetUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const collaboration = await PhotoCollab.findOne({
      _id: req.params.collaborationId,
      $or: [
        { 'inviter.user_id': targetUser._id },
        { 'receiver.user_id': targetUser._id }
      ],
      status: 'accepted'
    }).populate([
      { path: 'inviter.user_id', select: 'name username' },
      { path: 'receiver.user_id', select: 'name username' }
    ]);

    if (!collaboration) {
      return res.status(404).json({
        success: false,
        message: 'Collaboration not found or not in accepted status'
      });
    }

    const finalImages = await generateFinalCollaboration(collaboration);
    
    collaboration.status = 'completed';
    collaboration.completed_at = new Date();
    collaboration.merged_images = finalImages;
    
    await collaboration.save();

    const otherUser = collaboration.inviter.user_id._id.toString() === targetUser._id.toString() 
      ? collaboration.receiver.user_id 
      : collaboration.inviter.user_id;

    try {
      await socketService.sendNotificationToUser(otherUser._id, {
        type: 'photo_collab_completed',
        title: '🎉 Collaboration Completed!',
        message: `${targetUser.username} finalized your collaboration`,
        data: {
          collaboration_id: collaboration._id,
          completed_by: {
            id: targetUser._id,
            username: targetUser.username
          }
        }
      });
    } catch (notifError) {
      console.error('Failed to send completion notification:', notifError);
    }

    console.log(`✅ COLLAB COMPLETED: ${targetUser.username} completed collaboration ${collaboration._id}`);

    res.json({
      success: true,
      message: 'Collaboration completed successfully',
      data: {
        collaboration: {
          id: collaboration._id,
          status: collaboration.status,
          completed_at: collaboration.completed_at,
          final_images: finalImages.map(img => req.protocol + '://' + req.get('host') + '/' + img)
        }
      }
    });

  } catch (error) {
    console.error('Complete collaboration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

async function createCollaborationMerge(collaboration, receiverPhoto) {
  try {
    console.log('🎨 Creating collaboration merge...');
    
    const inviterPhoto = await Photo.findById(collaboration.inviter.photo_id);
    if (!inviterPhoto) {
      throw new Error('Inviter photo not found');
    }

    const mergedImages = [];

    const maxImages = Math.max(inviterPhoto.images.length, receiverPhoto.images.length);
    
    for (let i = 0; i < maxImages; i++) {
      const inviterImagePath = inviterPhoto.images[i];
      const receiverImagePath = receiverPhoto.images[i];
      
      if (inviterImagePath && receiverImagePath) {

        const mergedImagePath = await createSideBySideMerge(
          path.join(process.cwd(), inviterImagePath),
          path.join(process.cwd(), receiverImagePath),
          `collab-${collaboration._id}-${i}`
        );
        mergedImages.push(mergedImagePath);
      }
    }

    console.log(`✅ Created ${mergedImages.length} merged images for collaboration`);
    return mergedImages;

  } catch (error) {
    console.error('Error creating collaboration merge:', error);
    throw error;
  }
}

async function createSideBySideMerge(image1Path, image2Path, filename) {
  try {
    const outputPath = path.join(process.cwd(), 'images', 'photos', `${filename}.jpg`);

    const image1 = sharp(image1Path);
    const image2 = sharp(image2Path);

    const [meta1, meta2] = await Promise.all([
      image1.metadata(),
      image2.metadata()
    ]);

    const targetHeight = Math.min(meta1.height, meta2.height);
    const targetWidth1 = Math.round((meta1.width * targetHeight) / meta1.height);
    const targetWidth2 = Math.round((meta2.width * targetHeight) / meta2.height);
    const totalWidth = targetWidth1 + targetWidth2;

    const resized1 = await image1
      .resize(targetWidth1, targetHeight)
      .jpeg({ quality: 85 })
      .toBuffer();
      
    const resized2 = await image2
      .resize(targetWidth2, targetHeight)
      .jpeg({ quality: 85 })
      .toBuffer();

    await sharp({
      create: {
        width: totalWidth,
        height: targetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .composite([
      { input: resized1, left: 0, top: 0 },
      { input: resized2, left: targetWidth1, top: 0 }
    ])
    .jpeg({ quality: 85 })
    .toFile(outputPath);
    
    return imageHandler.getRelativeImagePath(outputPath);

  } catch (error) {
    console.error('Error creating side-by-side merge:', error);
    throw error;
  }
}

async function generateFinalCollaboration(collaboration) {
  try {
    console.log('🎨 Generating final collaboration with stickers...');
    
    if (!collaboration.merged_images || collaboration.merged_images.length === 0) {
      throw new Error('No merged images found');
    }

    const finalImages = [];

    for (let i = 0; i < collaboration.merged_images.length; i++) {
      const mergedImagePath = path.join(process.cwd(), collaboration.merged_images[i]);
      const finalImagePath = await addStickersToImage(
        mergedImagePath,
        collaboration.stickers,
        `final-collab-${collaboration._id}-${i}`
      );
      finalImages.push(finalImagePath);
    }

    console.log(`✅ Generated ${finalImages.length} final collaboration images`);
    return finalImages;

  } catch (error) {
    console.error('Error generating final collaboration:', error);
    throw error;
  }
}

async function addStickersToImage(imagePath, stickers, filename) {
  try {
    const outputPath = path.join(process.cwd(), 'images', 'photos', `${filename}.jpg`);


    const image = sharp(imagePath);



    
    await image
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    return imageHandler.getRelativeImagePath(outputPath);

  } catch (error) {
    console.error('Error adding stickers to image:', error);
    throw error;
  }
}

module.exports = router;