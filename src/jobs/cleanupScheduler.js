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

  start(cronExpression) {
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
        console.log(`Automated photo cleanup started at ${this.lastRun.toLocaleTimeString()}`);
        
        const cleanupResult = await photoCleanupService.cleanupExpiredPhotos();
        
        this.stats.total_runs++;
        
        if (cleanupResult.success) {
          this.stats.successful_runs++;
          this.stats.total_photos_processed += cleanupResult.processed;
          this.stats.total_files_deleted += cleanupResult.deleted_files;
          this.stats.total_records_deleted += cleanupResult.deleted_records || 0;

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
        console.log(`Cleanup cycle completed at ${new Date().toLocaleTimeString()}\n`);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Jakarta'
    });

    console.log('Photo cleanup scheduler started successfully');
  }
}

module.exports = new CleanupScheduler();