const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order_id: {
        type: String,
        required: true,
        unique: true
    },
    duitku_reference: {
        type: String,
        default: null
    },
    payment_method: {
        type: String,
        default: null
    },
    payment_code: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'expired', 'grace_period', 'cancelled', 'refunded'],
        default: 'pending'
    },
    payment_url: {
        type: String,
        default: null
    },
    va_number: {
        type: String,
        default: null
    },
    qr_string: {
        type: String,
        default: null
    },
    expires_at: {
        type: Date,
        required: true
    },
    paid_at: {
        type: Date,
        default: null
    },
    subscription_start_date: {
        type: Date,
        default: null
    },
    subscription_end_date: {
        type: Date,
        default: null
    },
    publisher_order_id: {
        type: String,
        default: null
    },
    settlement_date: {
        type: Date,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },


    auto_renewal_enabled: {
        type: Boolean,
        default: true
    },
    renewal_notification_sent: {
        type: Boolean,
        default: false
    },
    renewal_attempted: {
        type: Boolean,
        default: false
    },
    renewal_attempt_count: {
        type: Number,
        default: 0
    },
    last_renewal_attempt: {
        type: Date,
        default: null
    },
    last_renewal_date: {
        type: Date,
        default: null
    },
    next_billing_date: {
        type: Date,
        default: null
    },


    cancellation_reason: {
        type: String,
        default: null
    },
    cancelled_at: {
        type: Date,
        default: null
    },
    cancelled_by: {
        type: String,
        enum: ['user', 'admin', 'system'],
        default: null
    },


    refund_reference: {
        type: String,
        default: null
    },
    refunded_at: {
        type: Date,
        default: null
    },
    refund_amount: {
        type: Number,
        default: null
    },
    refund_status: {
        type: String,
        enum: ['pending', 'processed', 'failed', 'rejected'],
        default: null
    },


    grace_period_start: {
        type: Date,
        default: null
    },
    grace_period_end: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ order_id: 1 });
subscriptionSchema.index({ duitku_reference: 1 });
subscriptionSchema.index({ expires_at: 1 });
subscriptionSchema.index({ subscription_end_date: 1, auto_renewal_enabled: 1 });
subscriptionSchema.index({ next_billing_date: 1 });
subscriptionSchema.index({ grace_period_end: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
