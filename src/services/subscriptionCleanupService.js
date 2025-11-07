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

                if (!activeSubscription) {
                    user.role = 'verified_basic';
                    await user.save();
                    downgraded++;

                    console.log(`Downgraded user ${user.username} (${user._id}) from premium to basic`);
                }
            }

            console.log(`Downgraded ${downgraded} users from premium to basic`);
        } catch (error) {
            console.error('Error downgrading expired users:', error);
        }
    }

    /**
     * Manually trigger cleanup (for testing)
     */
    async manualCleanup() {
        console.log('Running manual subscription cleanup...');
        await this.cleanupExpiredSubscriptions();
        await this.downgradeExpiredUsers();
        console.log('Manual cleanup completed');
    }
}

module.exports = new SubscriptionCleanupService();
