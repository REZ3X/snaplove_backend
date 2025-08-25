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
    } catch (error) {
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
        await this.ensureDirectoryExists(this.framesDir);
        cb(null, this.framesDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `frame-${uniqueSuffix}${ext}`);
      }
    });
  }

  getPhotoStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        await this.ensureDirectoryExists(this.photosDir);
        cb(null, this.photosDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `photo-${uniqueSuffix}${ext}`);
      }
    });
  }

  getTicketStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        await this.ensureDirectoryExists(this.ticketsDir);
        cb(null, this.ticketsDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `ticket-${uniqueSuffix}${ext}`);
      }
    });
  }

  imageFileFilter(req, file, cb) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg', 'image/avif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, SVG, and AVIF are allowed.'), false);
    }
  }

  getFrameUpload() {
    return multer({
      storage: this.getFrameStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
      }
    });
  }

  getPhotoUpload() {
    return multer({
      storage: this.getPhotoStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 5
      }
    });
  }

  getTicketUpload() {
    return multer({
      storage: this.getTicketStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 3
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