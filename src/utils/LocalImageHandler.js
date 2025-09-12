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

  getProfileStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await this.ensureDirectoryExists(this.profilesDir);
          cb(null, this.profilesDir);
        } catch (e) {
          cb(e);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, `profile-${uniqueSuffix}${ext}`);
      }
    });
  }

  getPhotoStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await this.ensureDirectoryExists(this.photosDir);
          cb(null, this.photosDir);
        } catch (e) {
          cb(e);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, `photo-${uniqueSuffix}${ext}`);
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

  getFrameUpload() {
    return multer({
      storage: this.getFrameStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    });
  }

  getProfileUpload() {
    return multer({
      storage: this.getProfileStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    });
  }

  getPhotoUpload() {
    return multer({
      storage: this.getPhotoStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    });
  }

  getPublicFrameUpload() {
    return multer({
      storage: this.getFrameStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    });
  }

  getTicketStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await this.ensureDirectoryExists(this.ticketsDir);
          cb(null, this.ticketsDir);
        } catch (e) {
          cb(e);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.bin';
        cb(null, `ticket-${uniqueSuffix}${ext}`);
      }
    });
  }

  getTicketUpload() {
    return multer({
      storage: this.getTicketStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
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
      let fullPath;

      if (path.isAbsolute(relativePath)) {
        fullPath = relativePath;
      } else if (relativePath.startsWith('images/')) {
        fullPath = path.join(process.cwd(), relativePath);
      } else {
        const filename = path.basename(relativePath);

        let subDir;
        if (filename.startsWith('frame-')) {
          subDir = this.framesDir;
        } else if (filename.startsWith('photo-')) {
          subDir = this.photosDir;
        } else if (filename.startsWith('profile-')) {
          subDir = this.profilesDir;
        } else if (filename.startsWith('ticket-')) {
          subDir = this.ticketsDir;
        } else {
          fullPath = path.join(process.cwd(), relativePath);
        }

        if (subDir) {
          fullPath = path.join(subDir, filename);
        }
      }

      await fs.access(fullPath);
      await fs.unlink(fullPath);

      console.log(`✅ Successfully deleted image: ${fullPath}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠️ Image file not found (may already be deleted): ${relativePath}`);
        return true;
      }
      console.error(`❌ Error deleting image ${relativePath}:`, error.message);
      return false;
    }
  }
}

module.exports = new LocalImageHandler();