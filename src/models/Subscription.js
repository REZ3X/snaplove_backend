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
        enum: ['pending', 'success', 'failed', 'expired'],
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
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ order_id: 1 });
subscriptionSchema.index({ duitku_reference: 1 });
subscriptionSchema.index({ expires_at: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
