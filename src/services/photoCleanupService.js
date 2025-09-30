const Photo = require('../models/Photo');
const imageHandler = require('../utils/LocalImageHandler');
const fs = require('fs').promises;
const path = require('path');

class PhotoCleanupService {
  /**
   * Clean up expired photos (automated only)
   * Buffer time: 5 minutes before actual expiry to handle MongoDB TTL delays
   */
  async cleanupExpiredPhotos() {
    try {
      console.log('Starting automated photo cleanup...');

      const bufferMinutes = 5;
      const cleanupThreshold = new Date(Date.now() + (bufferMinutes * 60 * 1000));
      
      const expiredPhotos = await Photo.find({
        expires_at: { 
          $lte: cleanupThreshold,
          $ne: null 
        }
      }).select('_id images user_id expires_at');

      if (expiredPhotos.length === 0) {
        console.log('No expired photos found');
        return {
          success: true,
          processed: 0,
          deleted_records: 0,
          deleted_files: 0,
          failed_records: 0,
          failed_files: 0,
          message: 'No expired photos to clean up'
        };
      }

      console.log(`Found ${expiredPhotos.length} expired photos to process`);
      
      let totalDeletedFiles = 0;
      let totalFailedFiles = 0;
      let deletedRecords = 0;
      let failedRecords = 0;
      let processedPhotos = 0;

      for (const photo of expiredPhotos) {
        try {
          console.log(`Processing photo ${photo._id} (expires: ${photo.expires_at})`);

          const deletedFiles = [];
          const failedFiles = [];
          
          for (const imagePath of photo.images) {
            try {
              const deleted = await imageHandler.deleteImage(imagePath);
              if (deleted) {
                deletedFiles.push(imagePath);
                console.log(`Deleted file: ${imagePath}`);
              } else {
                failedFiles.push(imagePath);
                console.log(`File not found: ${imagePath}`);
              }
            } catch (error) {
              console.error(`Error deleting image ${imagePath}:`, error.message);
              failedFiles.push(imagePath);
            }
          }

          try {
            await Photo.findByIdAndDelete(photo._id);
            deletedRecords++;
            console.log(`Deleted photo record: ${photo._id}`);
          } catch (error) {
            console.error(`Error deleting photo record ${photo._id}:`, error.message);
            failedRecords++;
          }

          totalDeletedFiles += deletedFiles.length;
          totalFailedFiles += failedFiles.length;
          processedPhotos++;

          console.log(`Photo ${photo._id} processed: ${deletedFiles.length} files deleted, ${failedFiles.length} failed`);

        } catch (error) {
          console.error(`Error processing photo ${photo._id}:`, error);
          processedPhotos++;
          failedRecords++;
        }
      }

      const result = {
        success: true,
        processed: processedPhotos,
        deleted_records: deletedRecords,
        deleted_files: totalDeletedFiles,
        failed_records: failedRecords,
        failed_files: totalFailedFiles,
        message: `Processed ${processedPhotos} expired photos, deleted ${deletedRecords} records and ${totalDeletedFiles} files`
      };

      console.log(`Automated cleanup completed:`, result);
      return result;

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

  /**
   * Get statistics about expiring photos
   * @param {number} hours - Look ahead this many hours
   */
  async getExpiringPhotosStats(hours = 24) {
    try {
      const now = new Date();
      const futureThreshold = new Date(now.getTime() + (hours * 60 * 60 * 1000));

      const [currentlyExpired, expiringWithinHours, totalPhotosWithExpiry] = await Promise.all([

        Photo.countDocuments({
          expires_at: { 
            $lte: now,
            $ne: null 
          }
        }),

        Photo.countDocuments({
          expires_at: { 
            $gt: now,
            $lte: futureThreshold,
            $ne: null 
          }
        }),

        Photo.countDocuments({
          expires_at: { $ne: null }
        })
      ]);

      return {
        currently_expired: currentlyExpired,
        expiring_within_hours: expiringWithinHours,
        total_with_expiry: totalPhotosWithExpiry,
        hours_ahead: hours,
        checked_at: now.toISOString()
      };

    } catch (error) {
      console.error('Error getting expiring photos stats:', error);
      return {
        currently_expired: 0,
        expiring_within_hours: 0,
        total_with_expiry: 0,
        hours_ahead: hours,
        error: error.message
      };
    }
  }

  /**
   * Clean up orphaned image files (files that exist but have no photo record)
   * This is for maintenance purposes
   */
  async cleanupOrphanedImageFiles() {
    try {
      console.log('Starting orphaned files cleanup...');
      
      const photosDir = path.join(process.cwd(), 'images', 'photos');

      try {
        await fs.access(photosDir);
      } catch (error) {
        console.log('Photos directory does not exist, nothing to clean');
        return {
          success: true,
          scanned_files: 0,
          deleted_files: 0,
          failed_files: 0,
          message: 'Photos directory does not exist'
        };
      }

      const files = await fs.readdir(photosDir);
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      );

      if (imageFiles.length === 0) {
        console.log('No image files found in photos directory');
        return {
          success: true,
          scanned_files: 0,
          deleted_files: 0,
          failed_files: 0,
          message: 'No image files found'
        };
      }

      console.log(`Found ${imageFiles.length} image files to check`);

      const photos = await Photo.find({ images: { $exists: true, $not: { $size: 0 } } })
        .select('images')
        .lean();

      const referencedPaths = new Set();
      photos.forEach(photo => {
        photo.images.forEach(imagePath => {

          const filename = path.basename(imagePath);
          referencedPaths.add(filename);
        });
      });

      console.log(`Found ${referencedPaths.size} referenced image files in database`);

      const orphanedFiles = imageFiles.filter(file => !referencedPaths.has(file));
      
      if (orphanedFiles.length === 0) {
        console.log('No orphaned files found');
        return {
          success: true,
          scanned_files: imageFiles.length,
          deleted_files: 0,
          failed_files: 0,
          message: 'No orphaned files found'
        };
      }

      console.log(`Found ${orphanedFiles.length} orphaned files to delete`);

      let deletedFiles = 0;
      let failedFiles = 0;

      for (const file of orphanedFiles) {
        try {
          const filePath = path.join(photosDir, file);
          await fs.unlink(filePath);
          deletedFiles++;
          console.log(`Deleted orphaned file: ${file}`);
        } catch (error) {
          console.error(`Failed to delete orphaned file ${file}:`, error.message);
          failedFiles++;
        }
      }

      const result = {
        success: true,
        scanned_files: imageFiles.length,
        orphaned_files: orphanedFiles.length,
        deleted_files: deletedFiles,
        failed_files: failedFiles,
        message: `Scanned ${imageFiles.length} files, deleted ${deletedFiles} orphaned files`
      };

      console.log('Orphaned files cleanup completed:', result);
      return result;

    } catch (error) {
      console.error('Orphaned files cleanup error:', error);
      return {
        success: false,
        error: error.message,
        scanned_files: 0,
        deleted_files: 0,
        failed_files: 0
      };
    }
  }

  /**
   * Get detailed photo storage statistics
   */
  async getStorageStats() {
    try {
      const photosDir = path.join(process.cwd(), 'images', 'photos');

      let totalFiles = 0;
      let totalSize = 0;
      
      try {
        const files = await fs.readdir(photosDir);
        const imageFiles = files.filter(file => 
          /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
        );
        
        totalFiles = imageFiles.length;

        for (const file of imageFiles) {
          try {
            const filePath = path.join(photosDir, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
          } catch (error) {
            console.warn(`Could not get stats for file ${file}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('Could not read photos directory:', error.message);
      }

      const [totalPhotos, photosWithExpiry, expiredPhotos] = await Promise.all([
        Photo.countDocuments(),
        Photo.countDocuments({ expires_at: { $ne: null } }),
        Photo.countDocuments({ 
          expires_at: { 
            $lte: new Date(),
            $ne: null 
          }
        })
      ]);

      return {
        storage: {
          total_files: totalFiles,
          total_size_bytes: totalSize,
          total_size_mb: Math.round(totalSize / (1024 * 1024) * 100) / 100,
          directory: photosDir
        },
        database: {
          total_photos: totalPhotos,
          photos_with_expiry: photosWithExpiry,
          expired_photos: expiredPhotos,
          permanent_photos: totalPhotos - photosWithExpiry
        },
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        error: error.message,
        generated_at: new Date().toISOString()
      };
    }
  }

  /**
   * Manual cleanup for specific user (admin function)
   * @param {string} userId - User ID to cleanup photos for
   */
  async cleanupUserPhotos(userId) {
    try {
      console.log(`Starting manual cleanup for user: ${userId}`);

      const userPhotos = await Photo.find({ user_id: userId })
        .select('_id images user_id expires_at');

      if (userPhotos.length === 0) {
        return {
          success: true,
          processed: 0,
          deleted_records: 0,
          deleted_files: 0,
          message: 'No photos found for this user'
        };
      }

      console.log(`Found ${userPhotos.length} photos for user ${userId}`);

      let totalDeletedFiles = 0;
      let deletedRecords = 0;
      let failedRecords = 0;
      let failedFiles = 0;

      for (const photo of userPhotos) {
        try {

          for (const imagePath of photo.images) {
            try {
              const deleted = await imageHandler.deleteImage(imagePath);
              if (deleted) {
                totalDeletedFiles++;
              } else {
                failedFiles++;
              }
            } catch (error) {
              console.error(`Error deleting image ${imagePath}:`, error.message);
              failedFiles++;
            }
          }

          await Photo.findByIdAndDelete(photo._id);
          deletedRecords++;

        } catch (error) {
          console.error(`Error processing photo ${photo._id}:`, error);
          failedRecords++;
        }
      }

      const result = {
        success: true,
        processed: userPhotos.length,
        deleted_records: deletedRecords,
        deleted_files: totalDeletedFiles,
        failed_records: failedRecords,
        failed_files: failedFiles,
        message: `Cleaned up ${deletedRecords} photos and ${totalDeletedFiles} files for user ${userId}`
      };

      console.log('User cleanup completed:', result);
      return result;

    } catch (error) {
      console.error('User cleanup error:', error);
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