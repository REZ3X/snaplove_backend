require("dotenv").config();
const http = require("http");
const socketService = require("./services/socketService");
const express = require("express");
// const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const connectDB = require("./lib/mongodb");

const os = require("os");
const mongoose = require("mongoose");
const User = require("./models/User");
const Frame = require("./models/Frame");
const Photo = require("./models/Photo");

const createApiKeyAuth = require("./middleware/apiKeyAuth");
const docsAuth = require("./middleware/docsAuth");

const loginRoute = require("./api/auth/login/route");
const registerRoute = require("./api/auth/register/route");
const logoutRoute = require("./api/auth/logout/route");
const meRoute = require("./api/auth/me/route");

const framePublicRoute = require("./api/frame/public/route");
const frameByIdRoute = require("./api/frame/public/[id]/route");
const frameLikeRoute = require("./api/frame/public/[id]/like/route");
const userFrameAllRoute = require("./api/user/[username]/frame/route");
const userFramePrivateRoute = require("./api/user/[username]/frame/private/route");
const userFramePublicRoute = require("./api/user/[username]/frame/public/route");
const frameEditRoute = require("./api/user/[username]/frame/private/[id]/edit/route");
const framePrivateDetailRoute = require("./api/user/[username]/frame/private/[id]/route");
const frameDeleteRoute = require("./api/user/[username]/frame/private/[id]/delete/route");
const frameAdminDeleteRoute = require("./api/frame/public/[id]/admin/delete/route");

const photoCaptureRoute = require("./api/user/[username]/photo/capture/route");
const photoPrivateRoute = require("./api/user/[username]/photo/private/route");

const adminUsersRoute = require("./api/admin/users/route");
const adminUserDetailRoute = require("./api/admin/users/[username]/route");
const adminUserUpdateRoute = require("./api/admin/users/[username]/update/route");
const adminUserDeleteRoute = require("./api/admin/users/[username]/delete/route");

const userReportPrivateRoute = require("./api/user/[username]/report/private/route");
const userReportDetailRoute = require("./api/user/[username]/report/private/[id]/route");
const adminReportsRoute = require("./api/admin/reports/route");
const adminReportDetailRoute = require("./api/admin/reports/[id]/route");

const userTicketPrivateRoute = require("./api/user/[username]/ticket/private/route");
const userTicketDetailRoute = require("./api/user/[username]/ticket/private/[id]/route");
const adminTicketRoute = require("./api/admin/ticket/route");
const adminTicketDetailRoute = require("./api/admin/ticket/[id]/route");

const userProfileRoute = require("./api/user/[username]/route");
const userProfileEditRoute = require("./api/user/[username]/private/edit/route");
const userStatsRoute = require("./api/user/[username]/stats/route");
const userLikedPrivateRoute = require("./api/user/[username]/liked/private/route");

const photoPrivateDetailRoute = require("./api/user/[username]/photo/private/[id]/route");
const photoEditRoute = require("./api/user/[username]/photo/private/[id]/edit/route");
const photoDeleteRoute = require("./api/user/[username]/photo/private/[id]/delete/route");

const adminServerHealthRoute = require("./api/admin/serverHealth/route");

const frameApprovalRoute = require("./api/admin/framePublicApproval/route");

const leaderboardPublicRoute = require("./api/leaderboard/public/route");

const userNotificationPrivateRoute = require("./api/user/[username]/notification/private/route");
const userFollowerRoute = require("./api/user/[username]/follower/route");
const userFollowingRoute = require("./api/user/[username]/following/route");

const apiKeyAuth = createApiKeyAuth({
  skipPaths: ["/", "/health"],
  skipPatterns: [/^\/docs/, /^\/images/, /^\/uploads/],
  envOnly: "production",
});

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const imageHandler = require("./utils/LocalImageHandler");
imageHandler.initializeDirectories();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
} else if (process.env.NODE_ENV === "development") {
  app.set("trust proxy", true);
}

if (process.env.NODE_ENV !== "test") {
  connectDB();
}

app.use(apiKeyAuth);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "view", "index.html"));
});

app.use("/docs", docsAuth);
app.get("/docs", docsAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "view", "docs.html"));
});

app.get("/health", async (req, res) => {
  try {
    const startTime = Date.now();

    const systemInfo = {
      uptime: os.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    const databaseStatus = {
      connected: mongoose.connection.readyState === 1,
      status: ["disconnected", "connected", "connecting", "disconnecting"][
        mongoose.connection.readyState
      ],
    };

    const [userCount, frameCount, photoCount] = await Promise.all([
      User.countDocuments({ ban_status: false }),
      Frame.countDocuments({
        visibility: "public",
        approval_status: "approved",
      }),
      Photo.countDocuments(),
    ]).catch(() => [0, 0, 0]);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentFrames, recentUsers] = await Promise.all([
      Frame.countDocuments({
        created_at: { $gte: last24Hours },
        visibility: "public",
        approval_status: "approved",
      }),
      User.countDocuments({
        created_at: { $gte: last24Hours },
        ban_status: false,
      }),
    ]).catch(() => [0, 0]);

    const responseTime = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();

    const healthChecks = {
      database: databaseStatus.connected,
      response_time: responseTime < 1000,
      memory: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9,
    };

    const overallHealth = Object.values(healthChecks).every((check) => check);

    res.json({
      success: true,
      status: overallHealth ? "healthy" : "degraded",
      message: "Snaplove Backend API is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: require("../package.json").version,
      uptime: {
        seconds: Math.floor(systemInfo.uptime),
        formatted: formatUptime(systemInfo.uptime),
      },
      database: {
        status: databaseStatus.status,
        connected: databaseStatus.connected,
      },
      statistics: {
        active_users: userCount,
        public_frames: frameCount,
        total_photos: photoCount,
        recent_activity: {
          new_frames_24h: recentFrames,
          new_users_24h: recentUsers,
        },
      },
      performance: {
        response_time_ms: responseTime,
        memory_usage_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        node_version: systemInfo.nodeVersion,
      },
      health_checks: {
        database: healthChecks.database ? "pass" : "fail",
        response_time: healthChecks.response_time ? "pass" : "slow",
        memory: healthChecks.memory ? "pass" : "high",
        overall: overallHealth ? "healthy" : "degraded",
      },
      ...(process.env.NODE_ENV !== "production" && {
        debug: {
          ip: req.ip,
          ips: req.ips,
          "cf-connecting-ip": req.headers["cf-connecting-ip"],
          "x-forwarded-for": req.headers["x-forwarded-for"],
          "x-real-ip": req.headers["x-real-ip"],
        },
      }),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "Service temporarily unavailable",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      error:
        process.env.NODE_ENV !== "production"
          ? error.message
          : "Internal server error",
    });
  }
});

app.use(
  helmet({
    ...(process.env.NODE_ENV === "production" && {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["self"],
          styleSrc: ["self", "unsafe-inline"],
          scriptSrc: ["self"],
          imgSrc: ["self", "data:", "https:"],
        },
      },
    }),
  })
);

// Replace your CORS middleware with this enhanced debug version
// Add this BEFORE any other middleware that handles routes

// Enhanced CORS middleware with detailed logging
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const method = req.method;
  const path = req.path;
  
  // Always log CORS requests for debugging
  console.log(`\n🔍 CORS REQUEST DEBUG:`);
  console.log(`   Method: ${method}`);
  console.log(`   Path: ${path}`);
  console.log(`   Origin: "${origin}"`);
  console.log(`   Headers:`, {
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers'],
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
  });

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins();
  console.log(`   Allowed origins: ${JSON.stringify(allowedOrigins)}`);

  // Function to set CORS headers
  const setCorsHeaders = (allowedOrigin) => {
    console.log(`   ✅ Setting CORS headers for: "${allowedOrigin}"`);
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, Accept, Origin');
    res.header('Access-Control-Max-Age', '86400');
    res.header('Vary', 'Origin');
    
    // Additional headers that might help
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  };

  // Handle CORS logic
  if (Array.isArray(allowedOrigins)) {
    // Check exact origin match
    if (origin && allowedOrigins.includes(origin)) {
      setCorsHeaders(origin);
    } 
    // For production, be more strict
    else if (process.env.NODE_ENV === "production") {
      console.log(`   ❌ CORS BLOCKED: "${origin}" not in allowed list`);
      
      // For preflight requests, we need to respond with error but still set some headers
      if (method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', 'null');
        return res.status(403).json({
          success: false,
          message: 'CORS policy violation - origin not allowed',
          origin,
          allowed: allowedOrigins,
          timestamp: new Date().toISOString()
        });
      }
    }
    // For development, be more lenient
    else if (process.env.NODE_ENV === "development") {
      if (origin) {
        setCorsHeaders(origin);
        console.log(`   🟡 DEV: Allowing origin "${origin}"`);
      } else {
        setCorsHeaders('*');
        console.log(`   🟡 DEV: No origin, allowing all`);
      }
    }
    // No origin in non-production (like Postman)
    else if (!origin && process.env.NODE_ENV !== "production") {
      setCorsHeaders('*');
      console.log(`   🟡 No origin, allowing all (non-production)`);
    }
  } else if (allowedOrigins.includes("*")) {
    setCorsHeaders('*');
    console.log(`   🟡 Wildcard allowed`);
  }

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    console.log(`   🚀 Handling OPTIONS preflight request`);
    console.log(`   Response headers:`, {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers')
    });
    return res.status(200).end();
  }

  console.log(`   ➡️ Continuing to next middleware\n`);
  next();
});

// Simplified getAllowedOrigins function with better logging
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === "production") {
    const productionUrls = process.env.PRODUCTION_FRONTEND_URLS;
    console.log(`🌐 PRODUCTION_FRONTEND_URLS env var: "${productionUrls}"`);
    
    if (productionUrls) {
      const urls = productionUrls.split(",")
        .map((url) => url.trim())
        .filter(Boolean);
      
      console.log(`🌐 Parsed production URLs: ${JSON.stringify(urls)}`);
      return urls;
    }
    
    console.warn('⚠️ PRODUCTION_FRONTEND_URLS not set, using fallback');
    const fallback = [
      "https://snaplove.pics",
      "https://www.snaplove.pics"
    ];
    console.log(`🌐 Using fallback URLs: ${JSON.stringify(fallback)}`);
    return fallback;
  } else if (process.env.NODE_ENV === "development") {
    const devUrls = [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:4173",
      "http://localhost:3000",
      "https://localhost:3000",
      "https://localhost:3001",
    ];
    console.log(`🌐 Development URLs: ${JSON.stringify(devUrls)}`);
    return devUrls;
  }
  
  console.log(`🌐 Test environment - allowing wildcard`);
  return ["*"];
};

// Add a specific test endpoint to verify CORS is working
app.get("/api/test-cors", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working!",
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
});

// Enhanced error handling middleware (add this after all your routes)
app.use((err, req, res) => {
  console.error('\n🚨 ERROR MIDDLEWARE TRIGGERED:');
  console.error('Error:', err.message);
  console.error('Request:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });

  // If it's a CORS error, make sure we still set CORS headers
  if (err.message && err.message.includes("CORS")) {
    const origin = req.headers.origin;
    const allowedOrigins = getAllowedOrigins();
    
    if (Array.isArray(allowedOrigins) && origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    return res.status(403).json({
      success: false,
      message: "CORS policy violation",
      origin,
      timestamp: new Date().toISOString()
    });
  }

  // Regular error handling
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" && { 
      stack: err.stack,
      path: req.path,
      method: req.method
    })
  });
});

console.log('\n🔧 CORS Debug Mode Activated');
console.log('📊 Environment:', process.env.NODE_ENV);
console.log('🌐 Allowed Origins:', JSON.stringify(getAllowedOrigins()));
console.log('🔑 API Key Auth:', process.env.NODE_ENV === "production" ? "Enabled" : "Disabled");
console.log('📍 Test endpoint: GET /api/test-cors\n');

// KHUSUS: CORS untuk static images (TAMBAHKAN SEBELUM express.static)
app.use("/images", (req, res, next) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;

  if (process.env.NODE_ENV === "development") {
    console.log(
      `CORS Images check - Origin: ${origin}, Allowed: ${JSON.stringify(
        allowedOrigins
      )}`
    );
  }

  if (Array.isArray(allowedOrigins)) {
    if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      // Allow no-origin requests hanya di development/test
    } else if (
      !origin &&
      (process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test")
    ) {
      res.header("Access-Control-Allow-Origin", "*");
    } else {
      console.warn(`CORS BLOCKED for images: ${origin} not in allowed origins`);
      return res.status(403).json({
        success: false,
        message: "CORS policy violation for image access",
      });
    }
  } else if (allowedOrigins === "*" && process.env.NODE_ENV === "test") {
    res.header("Access-Control-Allow-Origin", "*");
  }

  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Cross-Origin-Resource-Policy", "cross-origin");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use("/images", express.static(path.join(process.cwd(), "images")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000000 : 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  skip: process.env.NODE_ENV === "test" ? () => true : () => false,
  keyGenerator: (req) => {
    if (process.env.NODE_ENV === "production") {
      return (
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection.remoteAddress ||
        req.ip
      );
    }
    return req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000000 : 5,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  skip: process.env.NODE_ENV === "test" ? () => true : () => false,
  keyGenerator: (req) => {
    if (process.env.NODE_ENV === "production") {
      return (
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection.remoteAddress ||
        req.ip
      );
    }
    return req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter, loginRoute);
app.use("/api/auth/register", authLimiter, registerRoute);
app.use("/api/auth/logout", logoutRoute);
app.use("/api/auth/me", meRoute);

app.use("/api/frame/public", framePublicRoute);
app.use("/api/frame/public", frameByIdRoute);
app.use("/api/frame/public", frameLikeRoute);
app.use("/api/frame/public", frameAdminDeleteRoute);

app.use("/api/user", userProfileRoute);
app.use("/api/user", userFollowingRoute);
app.use("/api/user", userFrameAllRoute);

app.use("/api/user", userFramePublicRoute);
app.use("/api/user", frameEditRoute);
app.use("/api/user", frameDeleteRoute);

app.use("/api/user", photoCaptureRoute);
app.use("/api/user", photoEditRoute);
app.use("/api/user", photoDeleteRoute);
app.use("/api/user", photoCaptureRoute);

app.use("/api/user", userProfileEditRoute);
app.use("/api/user", userStatsRoute);
app.use("/api/user", userNotificationPrivateRoute);
app.use("/api/user", userFollowerRoute);

app.use("/api/user", userReportDetailRoute);

/* admin routes */
app.use("/api/admin/reports", adminReportsRoute);
app.use("/api/admin/reports", adminReportDetailRoute);

app.use("/api/admin/ticket", adminTicketRoute);
app.use("/api/admin/ticket", adminTicketDetailRoute);

app.use("/api/admin/framePublicApproval", frameApprovalRoute);

app.use("/api/leaderboard/public", leaderboardPublicRoute);

app.use("/api/admin/users", adminUsersRoute);
app.use("/api/admin/users", adminUserDetailRoute);
app.use("/api/admin/users", adminUserUpdateRoute);
app.use("/api/admin/users", adminUserDeleteRoute);

app.use("/api/admin/serverHealth", adminServerHealthRoute);

/* private routes */
app.use("/api/user", userReportPrivateRoute);
app.use("/api/user", framePrivateDetailRoute);

app.use("/api/user", userLikedPrivateRoute);
app.use("/api/user", userFramePrivateRoute);

app.use("/api/user", userTicketPrivateRoute);
app.use("/api/user", userTicketDetailRoute);

app.use("/api/user", photoPrivateRoute);
app.use("/api/user", photoPrivateDetailRoute);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use((err, req, res, _next) => {
  // Handle CORS errors specifically
  if (err.message && err.message.includes("CORS")) {
    console.warn(
      `CORS blocked request from origin: ${req.headers.origin || "unknown"}`
    );
    return res.status(403).json({
      success: false,
      message: "CORS policy violation",
      ...(process.env.NODE_ENV !== "production" && {
        origin: req.headers.origin,
        allowedOrigins: getAllowedOrigins(),
      }),
    });
  }

  console.error("Global error:", err);
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

const server = http.createServer(app);

if (process.env.NODE_ENV !== "test") {
  socketService.initialize(server);

  server.listen(PORT, () => {
    console.log(`🚀 Snaplove Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📁 Images served from: ${path.join(process.cwd(), "images")}`);
    console.log(`🔒 Trust proxy: ${app.get("trust proxy")}`);
    console.log(`📡 Socket.IO enabled for real-time notifications`);
  });
}

module.exports = { app, server };
