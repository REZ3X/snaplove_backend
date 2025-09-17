const Photo = require('../models/Photo');
const imageHandler = require('../utils/LocalImageHandler');

class PhotoCleanupService {
  /**
   * Clean up expired photos (automated only)
   * Buffer time: 5 minutes before actual expiry to handle MongoDB TTL delays
   */
  async cleanupExpiredPhotos() {
    try {
      console.log('🧹 Starting automated photo cleanup...');
      
      // Find photos that expire within the next 5 minutes
      const bufferMinutes = 5;
      const cleanupThreshold = new Date(Date.now() + (bufferMinutes * 60 * 1000));
      
      const expiredPhotos = await Photo.find({
        expires_at: { 
          $lte: cleanupThreshold,
          $ne: null 
        }
      }).select('_id images user_id expires_at');

      if (expiredPhotos.length === 0) {
        console.log('✅ No expired photos found');
        return {
          success: true,
          processed: 0,
          deleted_files: 0,
          failed_files: 0,
          message: 'No expired photos to clean up'
        };
      }

      console.log(`🗑️ Found ${expiredPhotos.length} expired photos to process`);
      
      let totalDeletedFiles = 0;
      let totalFailedFiles = 0;
      let processedPhotos = 0;

      for (const photo of expiredPhotos) {
        try {
          console.log(`📸 Processing photo ${photo._id} (expires: ${photo.expires_at})`);
          
          // Delete image files
          const deletedFiles = [];
          const failedFiles = [];
          
          for (const imagePath of photo.images) {
            try {
              const deleted = await imageHandler.deleteImage(imagePath);
              if (deleted) {
                deletedFiles.push(imagePath);
              } else {
                failedFiles.push(imagePath);
              }
            } catch (error) {
              console.error(`❌ Error deleting image ${imagePath}:`, error.message);
              failedFiles.push(imagePath);
            }
          }

          totalDeletedFiles += deletedFiles.length;
          totalFailedFiles += failedFiles.length;
          processedPhotos++;

          console.log(`✅ Photo ${photo._id} processed: ${deletedFiles.length} files deleted, ${failedFiles.length} failed`);

        } catch (error) {
          console.error(`❌ Error processing photo ${photo._id}:`, error);
          processedPhotos++;
        }
      }

      const result = {
        success: true,
        processed: processedPhotos,
        deleted_files: totalDeletedFiles,
        failed_files: totalFailedFiles,
        message: `Processed ${processedPhotos} expired photos`
      };

      console.log(`✅ Automated cleanup completed:`, result);
      return result;

    } catch (error) {
      console.error('❌ Photo cleanup service error:', error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        deleted_files: 0,
        failed_files: 0
      };
    }
  }
}

module.exports = new PhotoCleanupService();