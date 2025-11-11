const Subscription = require('../models/Subscription');
const User = require('../models/User');
const mailService = require('./mailService');
const duitkuService = require('./duitkuService');

class RenewalScheduler {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Check for subscriptions that need renewal reminders (7 days, 3 days, 1 day)
     */
    async checkUpcomingRenewals() {
        try {
            console.log('🔍 Checking for upcoming renewals...');

            const now = new Date();
            const _sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const _threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const _oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);


            const subscriptions = await Subscription.find({
                status: 'success',
                auto_renewal_enabled: true,
                subscription_end_date: { $exists: true, $ne: null }
            }).populate('user');

            for (const subscription of subscriptions) {
                if (!subscription.user) continue;

                const endDate = new Date(subscription.subscription_end_date);
                const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));


                if (daysUntilExpiry === 7 && !subscription.metadata?.reminder_7_days_sent) {
                    await mailService.sendRenewalReminder(subscription, subscription.user, 7);
                    subscription.metadata = {
                        ...subscription.metadata,
                        reminder_7_days_sent: true,
                        reminder_7_days_sent_at: new Date()
                    };
                    await subscription.save();
                    console.log(`✅ 7-day reminder sent for subscription ${subscription.order_id}`);
                }


                if (daysUntilExpiry === 3 && !subscription.metadata?.reminder_3_days_sent) {
                    await mailService.sendRenewalReminder(subscription, subscription.user, 3);
                    subscription.metadata = {
                        ...subscription.metadata,
                        reminder_3_days_sent: true,
                        reminder_3_days_sent_at: new Date()
                    };
                    await subscription.save();
                    console.log(`✅ 3-day reminder sent for subscription ${subscription.order_id}`);
                }


                if (daysUntilExpiry === 1 && !subscription.metadata?.reminder_1_day_sent) {
                    await mailService.sendRenewalReminder(subscription, subscription.user, 1);
                    subscription.metadata = {
                        ...subscription.metadata,
                        reminder_1_day_sent: true,
                        reminder_1_day_sent_at: new Date()
                    };
                    await subscription.save();
                    console.log(`✅ 1-day reminder sent for subscription ${subscription.order_id}`);
                }
            }

            console.log('✅ Upcoming renewals check completed');
        } catch (error) {
            console.error('❌ Error checking upcoming renewals:', error);
        }
    }

    /**
     * Check for subscriptions ending soon for users with auto-renewal disabled
     */
    async checkEndingSubscriptions() {
        try {
            console.log('🔍 Checking for ending subscriptions (auto-renewal disabled)...');

            const now = new Date();
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);


            const subscriptions = await Subscription.find({
                status: 'success',
                auto_renewal_enabled: false,
                subscription_end_date: {
                    $exists: true,
                    $ne: null,
                    $gte: now,
                    $lte: threeDaysFromNow
                }
            }).populate('user');

            for (const subscription of subscriptions) {
                if (!subscription.user) continue;

                const endDate = new Date(subscription.subscription_end_date);
                const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));


                if (daysUntilExpiry === 3 && !subscription.metadata?.ending_notification_sent) {
                    await mailService.sendSubscriptionEnding(subscription, subscription.user);
                    subscription.metadata = {
                        ...subscription.metadata,
                        ending_notification_sent: true,
                        ending_notification_sent_at: new Date()
                    };
                    await subscription.save();
                    console.log(`✅ Ending notification sent for subscription ${subscription.order_id}`);
                }
            }

            console.log('✅ Ending subscriptions check completed');
        } catch (error) {
            console.error('❌ Error checking ending subscriptions:', error);
        }
    }

    /**
     * Process automatic renewals for subscriptions expiring in 1 day
     */
    async processRenewals() {
        try {
            console.log('🔄 Processing subscription renewals...');

            const now = new Date();
            const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);


            const subscriptions = await Subscription.find({
                status: 'success',
                auto_renewal_enabled: true,
                subscription_end_date: {
                    $lte: oneDayFromNow,
                    $gte: now
                },
                renewal_attempted: false
            }).populate('user');

            console.log(`📊 Found ${subscriptions.length} subscriptions to renew`);

            for (const subscription of subscriptions) {
                if (!subscription.user) {
                    console.log(`⚠️ No user found for subscription ${subscription.order_id}`);
                    continue;
                }

                await this.processRenewalPayment(subscription);
            }

            console.log('✅ Renewal processing completed');
        } catch (error) {
            console.error('❌ Error processing renewals:', error);
        }
    }

    /**
     * Process a single renewal payment
     */
    async processRenewalPayment(subscription) {
        try {
            console.log(`💳 Processing renewal for subscription ${subscription.order_id}`);


            subscription.renewal_attempted = true;
            subscription.last_renewal_attempt = new Date();
            await subscription.save();









            const newOrderId = `SUB-RENEW-${subscription.user._id}-${Date.now()}`;

            try {

                const paymentRequest = await duitkuService.createPayment({
                    merchantOrderId: newOrderId,
                    paymentAmount: subscription.amount,
                    paymentMethod: subscription.payment_method,
                    productDetails: 'Snaplove Premium - Renewal',
                    customerVaName: subscription.user.name,
                    email: subscription.user.email,
                    phoneNumber: subscription.user.phone || '081234567890',
                    callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/subscription/callback`,
                    returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/payment/status`,
                    expiryPeriod: 1440
                });

                if (paymentRequest.statusCode === '00') {


                    await mailService.sendRenewalReminder(subscription, subscription.user, 0);


                    const newSubscription = new Subscription({
                        user: subscription.user._id,
                        order_id: newOrderId,
                        duitku_reference: paymentRequest.reference,
                        payment_method: subscription.payment_method,
                        amount: subscription.amount,
                        status: 'pending',
                        payment_url: paymentRequest.paymentUrl,
                        va_number: paymentRequest.vaNumber,
                        qr_string: paymentRequest.qrString,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        auto_renewal_enabled: true,
                        metadata: {
                            is_renewal: true,
                            previous_subscription_id: subscription._id
                        }
                    });
                    await newSubscription.save();

                    console.log(`✅ Renewal payment request created: ${newOrderId}`);
                } else {
                    throw new Error(`Payment request failed: ${paymentRequest.statusMessage}`);
                }
            } catch (paymentError) {
                console.error(`❌ Payment creation failed for ${subscription.order_id}:`, paymentError);
                await this.handleRenewalFailure(subscription);
            }
        } catch (error) {
            console.error(`❌ Error processing renewal payment for ${subscription.order_id}:`, error);
            await this.handleRenewalFailure(subscription);
        }
    }

    /**
     * Handle renewal payment failure
     */
    async handleRenewalFailure(subscription) {
        try {
            subscription.renewal_attempt_count = (subscription.renewal_attempt_count || 0) + 1;
            subscription.last_renewal_attempt = new Date();

            const user = await User.findById(subscription.user);
            if (!user) {
                console.log(`⚠️ User not found for subscription ${subscription.order_id}`);
                return;
            }

            if (subscription.renewal_attempt_count >= 3) {

                console.log(`⚠️ Max renewal attempts reached for ${subscription.order_id} - starting grace period`);

                subscription.status = 'grace_period';
                subscription.grace_period_start = subscription.subscription_end_date;
                subscription.grace_period_end = new Date(
                    subscription.subscription_end_date.getTime() + 3 * 24 * 60 * 60 * 1000
                );

                await subscription.save();
                await mailService.sendGracePeriodNotification(subscription, user);

                console.log(`📧 Grace period notification sent for ${subscription.order_id}`);
            } else {

                console.log(`🔄 Renewal attempt ${subscription.renewal_attempt_count}/3 for ${subscription.order_id}`);

                await subscription.save();
                await mailService.sendRenewalFailed(subscription, user, subscription.renewal_attempt_count);


                subscription.renewal_attempted = false;
                await subscription.save();
            }
        } catch (error) {
            console.error('❌ Error handling renewal failure:', error);
        }
    }

    /**
     * Check and expire grace period subscriptions
     */
    async processGracePeriodExpirations() {
        try {
            console.log('🔍 Checking for expired grace periods...');

            const now = new Date();

            const expiredGracePeriods = await Subscription.find({
                status: 'grace_period',
                grace_period_end: { $lte: now }
            }).populate('user');

            console.log(`📊 Found ${expiredGracePeriods.length} expired grace periods`);

            for (const subscription of expiredGracePeriods) {
                if (!subscription.user) continue;


                subscription.user.role = 'verified';
                await subscription.user.save();


                subscription.status = 'expired';
                await subscription.save();

                console.log(`❌ Grace period expired for ${subscription.order_id} - user downgraded`);
            }

            console.log('✅ Grace period expirations processed');
        } catch (error) {
            console.error('❌ Error processing grace period expirations:', error);
        }
    }

    /**
     * Start the renewal scheduler (run daily)
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Renewal scheduler is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Renewal scheduler started');


        await this.runAllChecks();


        this.interval = setInterval(async () => {
            await this.runAllChecks();
        }, 24 * 60 * 60 * 1000);
    }

    /**
     * Run all renewal checks
     */
    async runAllChecks() {
        console.log('🔄 Running renewal scheduler checks...');

        await this.checkUpcomingRenewals();
        await this.checkEndingSubscriptions();
        await this.processRenewals();
        await this.processGracePeriodExpirations();

        console.log('✅ All renewal checks completed');
    }

    /**
     * Stop the renewal scheduler
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.isRunning = false;
            console.log('🛑 Renewal scheduler stopped');
        }
    }
}

module.exports = new RenewalScheduler();
