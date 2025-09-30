const cron = require('node-cron');
const photoCleanupService = require('../services/photoCleanupService');

class CleanupScheduler {
  constructor() {
    this.job = null;
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      total_photos_processed: 0,
      total_files_deleted: 0,
      total_records_deleted: 0,
      last_error: null
    };
  }

  /**
   * Start the cleanup scheduler
   * Default: runs every 30 minutes
   * @param {string} cronExpression - Cron expression (default: every 30 minutes)
   */
  start(cronExpression = '*/30 * * * *') {
    if (this.job) {
      console.log('Cleanup scheduler is already running');
      return;
    }

    console.log(`Starting photo cleanup scheduler with pattern: ${cronExpression}`);
    console.log('Timezone: Asia/Jakarta');
    
    this.job = cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.log('Previous cleanup still running, skipping this run');
        return;
      }

      try {
        this.isRunning = true;
        this.lastRun = new Date();
        console.log(`Automated photo cleanup started at ${this.lastRun.toISOString()}`);

        const beforeStats = await photoCleanupService.getExpiringPhotosStats(1);
        console.log(`Before cleanup - Expired: ${beforeStats.currently_expired}, Expiring in 1h: ${beforeStats.expiring_within_hours}`);
        
        const cleanupResult = await photoCleanupService.cleanupExpiredPhotos();
        
        this.stats.total_runs++;
        
        if (cleanupResult.success) {
          this.stats.successful_runs++;
          this.stats.total_photos_processed += cleanupResult.processed;
          this.stats.total_files_deleted += cleanupResult.deleted_files;
          this.stats.total_records_deleted += cleanupResult.deleted_records || 0;
          
          console.log('Automated cleanup completed successfully:');
          console.log(`   Photos processed: ${cleanupResult.processed}`);
          console.log(`   DB records deleted: ${cleanupResult.deleted_records}`);
          console.log(`   Files deleted: ${cleanupResult.deleted_files}`);
          console.log(`   Failed records: ${cleanupResult.failed_records}`);
          console.log(`   Failed files: ${cleanupResult.failed_files}`);

          if (cleanupResult.failed_records > 0 || cleanupResult.failed_files > 0) {
            console.warn('Some operations failed during cleanup - check logs above');
          }
          
        } else {
          this.stats.failed_runs++;
          this.stats.last_error = cleanupResult.error;
          console.error('Automated cleanup failed:', cleanupResult.error);
        }
        
      } catch (error) {
        this.stats.failed_runs++;
        this.stats.last_error = error.message;
        console.error('Cleanup scheduler error:', error);
      } finally {
        this.isRunning = false;
        console.log(`Cleanup cycle completed at ${new Date().toISOString()}\n`);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Jakarta'
    });

    console.log('Photo cleanup scheduler started successfully');
    console.log('Use getStatus() to monitor scheduler performance');
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (this.job) {
      this.job.destroy();
      this.job = null;
      console.log('Photo cleanup scheduler stopped');
    } else {
      console.log('Cleanup scheduler is not running');
    }
  }

  /**
   * Get detailed scheduler status and statistics
   */
  getStatus() {
    const status = {
      scheduler: {
        is_scheduled: !!this.job,
        is_running: this.isRunning,
        last_run: this.lastRun ? this.lastRun.toISOString() : null,
        next_run: this.job ? 'Based on cron schedule' : null
      },
      statistics: {
        ...this.stats,
        success_rate: this.stats.total_runs > 0 
          ? `${((this.stats.successful_runs / this.stats.total_runs) * 100).toFixed(1)}%`
          : '0%',
        avg_photos_per_run: this.stats.successful_runs > 0
          ? Math.round(this.stats.total_photos_processed / this.stats.successful_runs)
          : 0
      },
      last_error: this.stats.last_error
    };

    return status;
  }

  /**
   * Get upcoming expiring photos statistics
   * @param {number} hours - Look ahead this many hours
   */
  async getUpcomingExpiry(hours = 24) {
    try {
      return await photoCleanupService.getExpiringPhotosStats(hours);
    } catch (error) {
      console.error('Error getting upcoming expiry stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Run cleanup manually (for testing or admin purposes)
   */
  async runManualCleanup() {
    if (this.isRunning) {
      console.log('Cleanup is already running');
      return { success: false, message: 'Cleanup already in progress' };
    }

    try {
      this.isRunning = true;
      console.log('Manual cleanup triggered');
      
      const result = await photoCleanupService.cleanupExpiredPhotos();

      console.log('Manual cleanup completed:', result);
      return result;
      
    } catch (error) {
      console.error('Manual cleanup error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run orphaned files cleanup (for maintenance)
   */
  async runOrphanedCleanup() {
    if (this.isRunning) {
      console.log('Cleanup is already running');
      return { success: false, message: 'Another cleanup already in progress' };
    }

    try {
      this.isRunning = true;
      console.log('Manual orphaned files cleanup triggered');
      
      const result = await photoCleanupService.cleanupOrphanedImageFiles();
      
      console.log('Orphaned files cleanup completed:', result);
      return result;
      
    } catch (error) {
      console.error('Orphaned cleanup error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Reset statistics (for testing or maintenance)
   */
  resetStats() {
    this.stats = {
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      total_photos_processed: 0,
      total_files_deleted: 0,
      total_records_deleted: 0,
      last_error: null
    };
    console.log('Cleanup statistics reset');
  }

  /**
   * Log current status to console (for monitoring)
   */
  logStatus() {
    const status = this.getStatus();
    console.log('\nCLEANUP SCHEDULER STATUS:');
    console.log(`   Scheduled: ${status.scheduler.is_scheduled}`);
    console.log(`   Running: ${status.scheduler.is_running}`);
    console.log(`   Last run: ${status.scheduler.last_run || 'Never'}`);
    console.log(`   Total runs: ${status.statistics.total_runs}`);
    console.log(`   Success rate: ${status.statistics.success_rate}`);
    console.log(`   Total photos processed: ${status.statistics.total_photos_processed}`);
    console.log(`   Total records deleted: ${status.statistics.total_records_deleted}`);
    console.log(`   Total files deleted: ${status.statistics.total_files_deleted}`);
    if (status.last_error) {
      console.log(`   Last error: ${status.last_error}`);
    }
    console.log('');
  }
}

module.exports = new CleanupScheduler();