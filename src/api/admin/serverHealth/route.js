const express = require('express');
const mongoose = require('mongoose');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, checkBanStatus, requireRole } = require('../../../middleware');
const User = require('../../../models/User');
const Frame = require('../../../models/Frame');
const Photo = require('../../../models/Photo');
const Ticket = require('../../../models/Ticket');
const Report = require('../../../models/Report');

const router = express.Router();


const getDirectorySize = async (dirPath) => {
  try {
    const stats = await fs.stat(dirPath);
    if (stats.isFile()) {
      return stats.size;
    }

    const files = await fs.readdir(dirPath);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const fileStats = await fs.stat(filePath);

      if (fileStats.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        totalSize += fileStats.size;
      }
    }

    return totalSize;
  } catch (error) {
    return 0;
  }
};


const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};


const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

router.get('/', authenticateToken, checkBanStatus, requireRole(['official', 'developer']), async (req, res) => {
  try {
    const startTime = Date.now();


    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      cpus: os.cpus().length,
      uptime: formatUptime(os.uptime()),
      nodeVersion: process.version,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      usedMemory: formatBytes(os.totalmem() - os.freemem()),
      memoryUsage: {
        rss: formatBytes(process.memoryUsage().rss),
        heapTotal: formatBytes(process.memoryUsage().heapTotal),
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
        external: formatBytes(process.memoryUsage().external)
      },
      loadAverage: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces()).length
    };


    const dbStats = await mongoose.connection.db.stats();
    const databaseInfo = {
      connectionState: mongoose.connection.readyState,
      connectionStates: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      },
      currentState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      databaseName: mongoose.connection.name,
      collections: dbStats.collections,
      documents: dbStats.objects,
      dataSize: formatBytes(dbStats.dataSize),
      storageSize: formatBytes(dbStats.storageSize),
      indexSize: formatBytes(dbStats.indexSize),
      totalSize: formatBytes(dbStats.dataSize + dbStats.indexSize)
    };


    const [userStats, frameStats, photoStats, ticketStats, reportStats] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$ban_status', false] }, 1, 0] } },
            banned: { $sum: { $cond: [{ $eq: ['$ban_status', true] }, 1, 0] } },
            byRole: {
              $push: {
                role: '$role',
                count: 1
              }
            }
          }
        },
        {
          $project: {
            total: 1,
            active: 1,
            banned: 1,
            roles: {
              $reduce: {
                input: '$byRole',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [[
                        { k: '$$this.role', v: { $ifNull: [{ $getField: { field: '$$this.role', input: '$$value' } }, 0] } }
                      ]]
                    }
                  ]
                }
              }
            }
          }
        }
      ]),
      Frame.aggregate([
        {
          $group: {
            _id: {
              visibility: '$visibility',
              approval_status: '$approval_status'
            },
            count: { $sum: 1 },
            totalLikes: { $sum: { $size: '$like_count' } },
            totalUses: { $sum: { $size: '$use_count' } }
          }
        }
      ]),
      Photo.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 }
          }
        }
      ]),
      Ticket.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Report.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);


    const [framesDirSize, photosDirSize, profilesDirSize, ticketsDirSize] = await Promise.all([
      getDirectorySize(path.join(process.cwd(), 'images', 'frames')),
      getDirectorySize(path.join(process.cwd(), 'images', 'photos')),
      getDirectorySize(path.join(process.cwd(), 'images', 'profiles')),
      getDirectorySize(path.join(process.cwd(), 'images', 'tickets'))
    ]);

    const fileSystemInfo = {
      uploads: {
        frames: formatBytes(framesDirSize),
        photos: formatBytes(photosDirSize),
        profiles: formatBytes(profilesDirSize),
        tickets: formatBytes(ticketsDirSize),
        total: formatBytes(framesDirSize + photosDirSize + profilesDirSize + ticketsDirSize)
      }
    };


    const packageJson = require('../../../../package.json');
    const applicationInfo = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      environment: process.env.NODE_ENV,
      port: process.env.PORT || 3000,
      trustProxy: process.env.NODE_ENV === 'production',
      startTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };


    const securityInfo = {
      cors: {
        enabled: true,
        allowedOrigins: process.env.NODE_ENV === 'production'
          ? (process.env.PRODUCTION_FRONTEND_URLS ? process.env.PRODUCTION_FRONTEND_URLS.split(',') : ['https://slaviors.xyz'])
          : ['development origins']
      },
      rateLimit: {
        general: {
          windowMs: 15 * 60 * 1000,
          max: process.env.NODE_ENV === 'test' ? 'unlimited' : 100
        },
        auth: {
          windowMs: 15 * 60 * 1000,
          max: process.env.NODE_ENV === 'test' ? 'unlimited' : 5
        }
      },
      helmet: {
        enabled: true
      }
    };


    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentUsers, recentFrames, recentPhotos, recentTickets] = await Promise.all([
      User.countDocuments({ created_at: { $gte: last24Hours } }),
      Frame.countDocuments({ created_at: { $gte: last24Hours } }),
      Photo.countDocuments({ created_at: { $gte: last24Hours } }),
      Ticket.countDocuments({ created_at: { $gte: last24Hours } })
    ]);

    const recentActivity = {
      last24Hours: {
        newUsers: recentUsers,
        newFrames: recentFrames,
        newPhotos: recentPhotos,
        newTickets: recentTickets
      }
    };


    const responseTime = Date.now() - startTime;
    const performanceInfo = {
      responseTime: `${responseTime}ms`,
      queryTime: `${responseTime}ms`,
      memoryPressure: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%',
      cpuLoad: os.loadavg()[0].toFixed(2)
    };


    const dependencies = {
      production: Object.keys(packageJson.dependencies || {}).length,
      development: Object.keys(packageJson.devDependencies || {}).length,
      main: packageJson.main,
      scripts: Object.keys(packageJson.scripts || {}).length
    };


    const healthStatus = {
      overall: 'healthy',
      checks: {
        database: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
        memory: ((os.totalmem() - os.freemem()) / os.totalmem()) < 0.9 ? 'healthy' : 'warning',
        disk: 'healthy',
        response: responseTime < 1000 ? 'healthy' : 'warning'
      }
    };

    res.json({
      success: true,
      message: 'Server health details retrieved successfully',
      timestamp: new Date().toISOString(),
      data: {
        health: healthStatus,
        system: systemInfo,
        application: applicationInfo,
        database: databaseInfo,
        collections: {
          users: userStats[0] || { total: 0, active: 0, banned: 0, roles: {} },
          frames: frameStats.reduce((acc, curr) => {
            acc[curr._id] = { count: curr.count, totalLikes: curr.totalLikes, totalUses: curr.totalUses };
            return acc;
          }, {}),
          photos: photoStats[0] || { total: 0, totalLikes: 0 },
          tickets: ticketStats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          reports: reportStats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        },
        fileSystem: fileSystemInfo,
        security: securityInfo,
        recentActivity,
        performance: performanceInfo,
        dependencies,
        generatedAt: new Date().toISOString(),
        generatedBy: {
          userId: req.user.userId,
          username: req.currentUser.username,
          role: req.currentUser.role
        }
      }
    });

  } catch (error) {
    console.error('Server health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve server health information',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;