const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    },
    type: {
        type: String,
        enum: ['announcement', 'maintenance', 'update', 'alert', 'celebration', 'general'],
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    target_audience: {
        type: String,
        enum: ['all', 'verified', 'premium', 'basic', 'official', 'developer', 'online_users'],
        default: 'all'
    },
    target_roles: [{
        type: String,
        enum: ['basic', 'verified_basic', 'verified_premium', 'official', 'developer']
    }],
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sent', 'cancelled'],
        default: 'draft'
    },
    scheduled_at: {
        type: Date,
        default: null
    },
    sent_at: {
        type: Date,
        default: null
    },
    expires_at: {
        type: Date,
        default: null
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sent_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    total_recipients: {
        type: Number,
        default: 0
    },
    notifications_created: {
        type: Number,
        default: 0
    },
    delivery_stats: {
        online_delivery: { type: Number, default: 0 },
        offline_delivery: { type: Number, default: 0 },
        failed_delivery: { type: Number, default: 0 }
    },

    settings: {
        send_to_new_users: { type: Boolean, default: false },
        persistent: { type: Boolean, default: true },
        dismissible: { type: Boolean, default: true },
        action_url: { type: String, default: null },
        icon: { type: String, default: null },
        color: { type: String, default: null }
    },
    metadata: {
        version: { type: String, default: null },
        feature_announcement: { type: String, default: null },
        maintenance_window: {
            start: { type: Date, default: null },
            end: { type: Date, default: null }
        }
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});


broadcastSchema.index({ created_by: 1, status: 1 });
broadcastSchema.index({ status: 1, scheduled_at: 1 });
broadcastSchema.index({ created_at: -1 });
broadcastSchema.index({ target_audience: 1, status: 1 });


broadcastSchema.virtual('type_emoji').get(function () {
    const emojis = {
        announcement: '📢',
        maintenance: '🔧',
        update: '🆕',
        alert: '⚠️',
        celebration: '🎉',
        general: '💬'
    };
    return emojis[this.type] || '💬';
});


broadcastSchema.virtual('priority_emoji').get(function () {
    const emojis = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        urgent: '🔴'
    };
    return emojis[this.priority] || '🟡';
});

module.exports = mongoose.model('Broadcast', broadcastSchema);