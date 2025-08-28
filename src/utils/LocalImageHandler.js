const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

class LocalImageHandler {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'images');
    this.framesDir = path.join(this.baseDir, 'frames');
    this.photosDir = path.join(this.baseDir, 'photos');
    this.profilesDir = path.join(this.baseDir, 'profiles');
    this.ticketsDir = path.join(this.baseDir, 'tickets');
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error){
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async initializeDirectories() {
    await this.ensureDirectoryExists(this.framesDir);
    await this.ensureDirectoryExists(this.photosDir);
    await this.ensureDirectoryExists(this.profilesDir);
    await this.ensureDirectoryExists(this.ticketsDir);
  }

  getFrameStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await this.ensureDirectoryExists(this.framesDir);
          cb(null, this.framesDir);
        } catch (e) {
          cb(e);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, `frame-${uniqueSuffix}${ext}`);
      }
    });
  }

  imageFileFilter(req, file, cb) {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg',
      'image/svg+xml',
      'image/avif'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, SVG, and AVIF are allowed.'), false);
  }

  // General frame upload (single file usage in other routes if needed)
  getFrameUpload() {
    return multer({
      storage: this.getFrameStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024
        // DO NOT set 'files' here to allow multiple fields (images + thumbnail)
      }
    });
  }

  // Explicit public frame uploader (same config; split for clarity/future custom)
  getPublicFrameUpload() {
    return multer({
      storage: this.getFrameStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    });
  }

  getRelativeImagePath(absolutePath) {
    const relativePath = path.relative(process.cwd(), absolutePath);
    return relativePath.replace(/\\/g, '/');
  }

  getImageUrl(relativePath, req) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/${relativePath}`;
  }

  async deleteImage(relativePath) {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }
}

module.exports = new LocalImageHandler();