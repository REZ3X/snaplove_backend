const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

class SubscriptionCleanupService {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Start the cleanup scheduler
     */
    start() {

        cron.schedule('0 0 * * *', async () => {
            console.log('Running subscription cleanup...');
            await this.cleanupExpiredSubscriptions();
            await this.expireCancelledSubscriptions();
            await this.downgradeExpiredUsers();
        });

        console.log('Subscription cleanup scheduler started');
    }

    /**
     * Mark expired pending subscriptions
     */
    async cleanupExpiredSubscriptions() {
        try {
            const now = new Date();

            const result = await Subscription.updateMany(
                {
                    status: 'pending',
                    expires_at: { $lte: now }
                },
                {
                    $set: { status: 'expired' }
                }
            );

            console.log(`Marked ${result.modifiedCount} subscriptions as expired`);
        } catch (error) {
            console.error('Error cleaning up expired subscriptions:', error);
        }
    }

    /**
     * Downgrade users with expired premium subscriptions
     * Also handles grace period expirations
     */
    async downgradeExpiredUsers() {
        try {
            const now = new Date();

            const premiumUsers = await User.find({ role: 'verified_premium' });

            let downgraded = 0;

            for (const user of premiumUsers) {


                const activeSubscription = await Subscription.findOne({
                    user: user._id,
                    status: 'success',
                    subscription_end_date: { $gt: now }
                });


                const gracePeriodSubscription = await Subscription.findOne({
                    user: user._id,
                    status: 'grace_period',
                    grace_period_end: { $gt: now }
                });


                if (!activeSubscription && !gracePeriodSubscription) {
                    user.role = 'verified';
                    await user.save();
                    downgraded++;

                    console.log(`Downgraded user ${user.username} (${user._id}) from premium to basic`);


                    await Subscription.updateMany(
                        {
                            user: user._id,
                            status: 'grace_period',
                            grace_period_end: { $lte: now }
                        },
                        {
                            $set: { status: 'expired' }
                        }
                    );
                }
            }

            console.log(`Downgraded ${downgraded} users from premium to basic`);
        } catch (error) {
            console.error('Error downgrading expired users:', error);
        }
    }

    /**
     * Mark cancelled subscriptions as expired after their end date
     */
    async expireCancelledSubscriptions() {
        try {
            const now = new Date();

            const result = await Subscription.updateMany(
                {
                    status: 'cancelled',
                    subscription_end_date: { $lte: now }
                },
                {
                    $set: { status: 'expired' }
                }
            );

            console.log(`Expired ${result.modifiedCount} cancelled subscriptions`);
        } catch (error) {
            console.error('Error expiring cancelled subscriptions:', error);
        }
    }

    /**
     * Manually trigger cleanup (for testing)
     */
    async manualCleanup() {
        console.log('Running manual subscription cleanup...');
        await this.cleanupExpiredSubscriptions();
        await this.expireCancelledSubscriptions();
        await this.downgradeExpiredUsers();
        console.log('Manual cleanup completed');
    }
}


const renewalScheduler = require('./renewalScheduler');


if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
        renewalScheduler.start();
    }, 5000);
}

module.exports = new SubscriptionCleanupService();
