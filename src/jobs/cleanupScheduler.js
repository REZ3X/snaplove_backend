const cron = require('node-cron');
const photoCleanupService = require('../services/photoCleanupService');

class CleanupScheduler {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  /**
   * Start the cleanup scheduler
   * Default: runs every 30 minutes
   * @param {string} cronExpression - Cron expression (default: every 30 minutes)
   */
  start(cronExpression = '*/30 * * * *') {
    if (this.job) {
      console.log('⚠️ Cleanup scheduler is already running');
      return;
    }

    console.log(`🕐 Starting photo cleanup scheduler with pattern: ${cronExpression}`);
    
    this.job = cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('⚠️ Previous cleanup still running, skipping this run');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🤖 Automated photo cleanup started');
        
        const stats = await photoCleanupService.cleanupExpiredPhotos();
        
        if (stats.success) {
          console.log(`✅ Automated cleanup completed: ${stats.processed} photos, ${stats.deleted_files} files deleted`);
        } else {
          console.error('❌ Automated cleanup failed:', stats.error);
        }
        
      } catch (error) {
        console.error('❌ Cleanup scheduler error:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: "Asia/Jakarta" // Adjust timezone as needed
    });

    console.log('✅ Photo cleanup scheduler started successfully');
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (this.job) {
      this.job.destroy();
      this.job = null;
      console.log('🛑 Photo cleanup scheduler stopped');
    } else {
      console.log('⚠️ Cleanup scheduler is not running');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isScheduled: !!this.job,
      isRunning: this.isRunning
    };
  }

  /**
   * Run cleanup manually (for testing or admin purposes)
   */
  async runManualCleanup() {
    if (this.isRunning) {
      console.log('⚠️ Cleanup is already running');
      return false;
    }

    try {
      this.isRunning = true;
      console.log('🧹 Manual cleanup triggered');
      
      const stats = await photoCleanupService.cleanupExpiredPhotos();
      return stats;
      
    } catch (error) {
      console.error('❌ Manual cleanup error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new CleanupScheduler();