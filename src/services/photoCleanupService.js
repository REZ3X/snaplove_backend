const Photo = require('../models/Photo');
const imageHandler = require('../utils/LocalImageHandler');
const PhotoCollab = require('../models/PhotoCollab');
const fs = require('fs').promises;
const path = require('path');

class PhotoCleanupService {
  async cleanupExpiredPhotos() {
    try {
      console.log('Starting automated photo cleanup...');

      // Ambil semua foto yang expires_at sudah lewat dari waktu sekarang
      const now = new Date();
      
      console.log('🕐 Current time:', now.toDateString(), now.toLocaleTimeString());
      
      const expiredPhotos = await Photo.find({
        expires_at: {
          $lte: now,
          $ne: null
        }
      }).select('_id images expires_at').lean();
      
      console.log(`📊 Found ${expiredPhotos.length} expired photos`);

      if (expiredPhotos.length === 0) {
        console.log('\n✅ No expired photos found');
        return {
          success: true,
          processed: 0,
          deleted_records: 0,
          deleted_files: 0,
          failed_records: 0,
          failed_files: 0,
        };
      }

      console.log(`Found ${expiredPhotos.length} expired photos to process`);

      let totalDeletedFiles = 0;
      let totalFailedFiles = 0;
      let deletedRecords = 0;
      let failedRecords = 0;

      for (const photo of expiredPhotos) {
        try {
          console.log(`Processing photo ${photo._id} (expired at: ${photo.expires_at})`);

          // Hapus semua files di array images
          if (photo.images && Array.isArray(photo.images)) {
            for (const imagePath of photo.images) {
              try {
                const deleted = await imageHandler.deleteImage(imagePath);
                if (deleted) {
                  totalDeletedFiles++;
                  console.log(`✓ Deleted: ${imagePath}`);
                } else {
                  totalFailedFiles++;
                  console.log(`✗ Not found: ${imagePath}`);
                }
              } catch (error) {
                console.error(`✗ Error deleting ${imagePath}:`, error.message);
                totalFailedFiles++;
              }
            }
          }

          // Hapus record dari database
          await Photo.findByIdAndDelete(photo._id);
          deletedRecords++;
          console.log(`✓ Deleted photo record: ${photo._id}`);

        } catch (error) {
          console.error(`✗ Error processing photo ${photo._id}:`, error.message);
          failedRecords++;
        }
      }

      const result = {
        success: true,
        processed: expiredPhotos.length,
        deleted_records: deletedRecords,
        deleted_files: totalDeletedFiles,
        failed_records: failedRecords,
        failed_files: totalFailedFiles,
      };

      const collabResult = await this.cleanupExpiredCollaborations();

      const combinedResult = {
        success: true,
        processed: result.processed + collabResult.processed,
        deleted_records: result.deleted_records + collabResult.deleted_records,
        deleted_files: result.deleted_files + collabResult.deleted_files,
        failed_records: result.failed_records + collabResult.failed_records,
        failed_files: result.failed_files + collabResult.failed_files,
        message: `${result.message}. ${collabResult.message}`
      };

      console.log(`All cleanup completed:`, combinedResult);
      return combinedResult;

    } catch (error) {
      console.error('Photo cleanup service error:', error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        deleted_records: 0,
        deleted_files: 0,
        failed_records: 0,
        failed_files: 0
      };
    }
  }

  async cleanupExpiredCollaborations() {
    try {
      console.log('🧹 Starting expired photo collaborations cleanup...');

      const expiredCollabs = await PhotoCollab.find({
        expires_at: { $lte: new Date() },
        status: { $in: ['pending', 'accepted'] }
      }).select('_id merged_images status');

      console.log(`🗑️ Found ${expiredCollabs.length} expired photo collaborations`);

      let deletedFiles = 0;
      let deletedRecords = 0;

      for (const collab of expiredCollabs) {
        try {
          if (collab.merged_images && collab.merged_images.length > 0) {
            for (const imagePath of collab.merged_images) {
              try {
                const deleted = await imageHandler.deleteImage(imagePath);
                if (deleted) deletedFiles++;
              } catch (error) {
                console.error(`Error deleting collab image ${imagePath}:`, error.message);
              }
            }
          }

          await PhotoCollab.findByIdAndDelete(collab._id);
          deletedRecords++;

        } catch (error) {
          console.error(`Error processing collaboration ${collab._id}:`, error);
        }
      }

      console.log(`✅ Collaboration cleanup completed: ${deletedRecords} records, ${deletedFiles} files deleted`);

      return {
        success: true,
        processed: expiredCollabs.length,
        deleted_records: deletedRecords,
        deleted_files: deletedFiles,
        message: `Cleaned up ${deletedRecords} expired collaborations and ${deletedFiles} files`
      };

    } catch (error) {
      console.error('❌ Photo collaboration cleanup error:', error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        deleted_records: 0,
        deleted_files: 0
      };
    }
  }
}

module.exports = new PhotoCleanupService();