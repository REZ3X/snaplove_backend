require("dotenv").config();
const http = require("http");
const socketService = require("./services/socketService");
const birthdayService = require("./services/birthdayService");
const discordBotService = require('./services/discordBotService');
const discordHandler = require('./utils/DiscordHookHandler');
const express = require("express");

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
// const verifyEmailRoute = require("./api/auth/verify-email/route");
// const resendVerificationRoute = require("./api/auth/resend-verification/route");

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
const frameLeaderboardRoute = require("./api/frame/public/[id]/leaderboard/route");
const frameTrendingRoute = require("./api/frame/public/trending/route");
const frameDiscoverRoute = require("./api/frame/public/discover/route");

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
const adminBroadcastRoute = require("./api/admin/broadcast/route");

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
const adminDiscordRoute = require("./api/admin/discord/route");

const frameApprovalRoute = require("./api/admin/framePublicApproval/route");

const leaderboardPublicRoute = require("./api/leaderboard/public/route");

const userNotificationPrivateRoute = require("./api/user/[username]/notification/private/route");
const userFollowerRoute = require("./api/user/[username]/follower/route");
const userFollowingRoute = require("./api/user/[username]/following/route");
const userBirthdayRoute = require("./api/user/[username]/birthday/route");

const searchRoute = require("./api/search/route");

const apiKeyAuth = createApiKeyAuth({
  skipPaths: ["/", "/health", "/lore", "/dev"],
  skipPatterns: [
    /^\/docs/, 
    /^\/images/, 
    /^\/uploads/
    // REMOVED email verification endpoints for testing
    // /^\/api\/auth\/(verify-email|resend-verification)/, 
  ],
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
      User.estimatedDocumentCount(),
      Frame.estimatedDocumentCount(),
      Photo.estimatedDocumentCount(),
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
      response_time: responseTime < 1500,
      memory: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.95,
    };

    const overallHealth = Object.values(healthChecks).every((check) => check);

        let emailStatus = 'disabled';
    try {
      if (process.env.BREVO_SMTP_HOST) {
        const mailService = require('./services/mailService');
        await mailService.testConnection();
        emailStatus = 'connected';
      }
    } catch (emailError) {
      console.error('Email service health check failed:', emailError);
      emailStatus = 'error';
    }

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
      services: {
        database: databaseStatus.status,
        email: emailStatus,
        discord_bot: process.env.DISCORD_BOT_TOKEN ? 'enabled' : 'disabled',
        socket_io: 'enabled'
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

app.get("/lore", (req, res) => {
  res.status(222).json({
    project: "The Hope Replacement",
    version: "0.0.2r",
    status: 222,
    messages: [
      "A hope replacement, that what I called this piece of shitty project.. with shitty routes and paths. Cuz honestly I create this backend app like creating Next.js API route which why it looks.. like shit. Started at August 13, the day I remember after days of planning for this projects. Taking the role as Project Manager and Backend Developer I sail the journey of bravery.. and of.. loss and.. suffer.",
      "That is the day after a YOLO question I asked to her.. then shattered me. Now I fully in the glimps of void.. fighting with my own mind for the rest of August 2025. Become distant, mad, and emosional.. and like drugs.. this backend project filled the hole of hope once I lost. Make me wonder and realize I just back to my stock spec.",
      "Until then.. early September.. I take all the courage to confess.. already knew the answer at August yet my mind and my heart couldn't bear the feeling. Rejection.. it's a big slap.. once again in my life. But hell this one just stay for normal relation.. that's why I continue this shit, pour all of my effort and time.. to distract myself.. and I always say to my friend that.. failing in love will always give you coding buff.",
      "- REZ3X"
    ],
    timestamp: "2025-09-13T18:00:00.000Z",
  });
});

app.get("/dev", (req, res) => {
  res.status(200).json({
    status: 200,
    developers: [
      {
        name: "Rejaka Abimanyu Susanto",
        occupation: [
          "Chief Technology Officer at Slaviors",
          "Project Manager and Lead Backend Developer at Snaplove Project"
        ],
      },
      {
        name: "Muhammad Ridhwan Kurniawan",
        occupation: [
          "Cyber Security Specialist at Slaviors",
          "Backend Developer and PenTest at Snaplove Project"
        ],
      }
    ]
  });
});

app.use(
  helmet({
    ...(process.env.NODE_ENV === "production" && {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "'data:'", "'https:'"],
        },
      },
    }),
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const method = req.method;
  const path = req.path;

  console.log(`\n🔍 CORS REQUEST DEBUG:`);
  console.log(`   Method: ${method}`);
  console.log(`   Path: ${path}`);
  console.log(`   Origin: "${origin}"`);
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 30) || 'unknown'}...`);

  const allowedOrigins = getAllowedOrigins();
  console.log(`   Allowed origins: ${JSON.stringify(allowedOrigins)}`);

  const setCorsHeaders = (allowedOrigin) => {
    console.log(`   ✅ Setting CORS headers for: "${allowedOrigin}"`);
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, Accept, Origin');
    res.header('Access-Control-Max-Age', '86400');
    res.header('Vary', 'Origin');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  };

  if (Array.isArray(allowedOrigins)) {
    if (origin && allowedOrigins.includes(origin)) {

      setCorsHeaders(origin);
    } else if (!origin) {

      console.log(`   🟡 No origin header - allowing for tools/APIs`);
      setCorsHeaders('*');
    } else if (process.env.NODE_ENV === "production") {

      console.log(`   ❌ CORS BLOCKED: "${origin}" not in allowed list`);

      if (method === 'OPTIONS') {
        return res.status(403).json({
          success: false,
          message: 'CORS policy violation - origin not allowed',
          origin,
          allowed: allowedOrigins,
          timestamp: new Date().toISOString()
        });
      }

    } else {

      if (origin) {
        setCorsHeaders(origin);
        console.log(`   🟡 DEV: Allowing origin "${origin}"`);
      } else {
        setCorsHeaders('*');
        console.log(`   🟡 DEV: No origin, allowing all`);
      }
    }
  } else if (allowedOrigins.includes("*")) {
    setCorsHeaders('*');
    console.log(`   🟡 Wildcard allowed`);
  }


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

app.use((err, req, res, _next) => {
  console.error('\n🚨 ERROR MIDDLEWARE TRIGGERED:');
  console.error('Error message:', err?.message || 'No error message');
  console.error('Error stack:', err?.stack || 'No stack trace');


  const requestInfo = {
    method: req?.method || 'unknown',
    url: req?.url || 'unknown',
    origin: req?.headers?.origin || 'no-origin',
    userAgent: req?.headers?.['user-agent']?.substring(0, 50) || 'unknown'
  };
  console.error('Request info:', requestInfo);

  if (err?.message && err.message.includes("CORS")) {
    const origin = req?.headers?.origin;
    const allowedOrigins = getAllowedOrigins();

    if (Array.isArray(allowedOrigins) && origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    return res.status(403).json({
      success: false,
      message: "CORS policy violation",
      origin: origin || 'no-origin',
      timestamp: new Date().toISOString()
    });
  }

  const statusCode = err?.status || err?.statusCode || 500;
  const errorMessage = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : (err?.message || "Unknown error");

  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" && {
      stack: err?.stack,
      path: req?.path,
      method: req?.method
    })
  });
});

app.get("/api/test-cors", (req, res) => {
  const origin = req.headers.origin;
  const corsHeaders = {
    'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
    'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
  };

  res.json({
    success: true,
    message: "CORS is working!",
    origin: origin || 'no-origin-header',
    timestamp: new Date().toISOString(),
    headers: corsHeaders,
    userAgent: req.headers['user-agent']?.substring(0, 50) || 'unknown',
    requestType: origin ? 'browser' : 'tool/api'
  });
});

console.log('\n🔧 CORS Debug Mode Activated');
console.log('📊 Environment:', process.env.NODE_ENV);
console.log('🌐 Allowed Origins:', JSON.stringify(getAllowedOrigins()));
console.log('🔑 API Key Auth:', process.env.NODE_ENV === "production" ? "Enabled" : "Disabled");
console.log('📍 Test endpoint: GET /api/test-cors\n');

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
    } else if (!origin) {
      console.log(`🟡 Images: No origin header - allowing for CDN/server requests`);
      res.header("Access-Control-Allow-Origin", "*");
    } else if (process.env.NODE_ENV === "production") {
      console.warn(`CORS BLOCKED for images: ${origin} not in allowed origins`);
      return res.status(403).json({
        success: false,
        message: "CORS policy violation for image access",
      });
    } else {
      res.header("Access-Control-Allow-Origin", "*");
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

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use("/images", express.static(path.join(process.cwd(), "images")));

app.use(apiKeyAuth);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000000 :
    process.env.NODE_ENV === "production" ? 500 : 200,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  },
  skip: process.env.NODE_ENV === "test" ? () => true : () => false,
  keyGenerator: (req) => {
    if (process.env.NODE_ENV === "production") {
      const ip = req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip;

      console.log(`Rate limit key for production: ${ip}`);
      return ip;
    }
    return req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
      retryAfter: 15 * 60,
      resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  },
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
// app.use("/api/auth/verify-email", verifyEmailRoute);
// app.use("/api/auth/resend-verification", authLimiter, resendVerificationRoute);

app.use("/api/frame/public", framePublicRoute);
app.use("/api/frame/public", frameByIdRoute);
app.use("/api/frame/public", frameLikeRoute);
app.use("/api/frame/public", frameAdminDeleteRoute);
app.use("/api/frame/public", frameLeaderboardRoute);
app.use("/api/frame/public", frameTrendingRoute);
app.use("/api/frame/public", frameDiscoverRoute);

app.use("/api/user", userProfileRoute);
app.use("/api/user", userFollowingRoute);
app.use("/api/user", userFramePublicRoute);
app.use("/api/user", userFrameAllRoute);

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
app.use("/api/user", userBirthdayRoute);

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
app.use("/api/admin/discord", adminDiscordRoute);

app.use("/api/admin/broadcast", adminBroadcastRoute);

/* private routes */
app.use("/api/user", userReportPrivateRoute);
app.use("/api/user", framePrivateDetailRoute);

app.use("/api/user", userLikedPrivateRoute);
app.use("/api/user", userFramePrivateRoute);

app.use("/api/user", userTicketPrivateRoute);
app.use("/api/user", userTicketDetailRoute);

app.use("/api/user", photoPrivateRoute);
app.use("/api/user", photoPrivateDetailRoute);

app.use("/api/search", searchRoute);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use((err, req, res, _next) => {

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
  birthdayService.start();

  discordBotService.start()
    .then(() => console.log('🤖 Discord bot integration started'))
    .catch(err => console.log('⚠️ Discord bot not available:', err.message));

  discordHandler.sendStartupMessage()
    .then(() => console.log('📢 Discord webhook connected with profile data'))
    .catch(err => console.log('⚠️ Discord webhook not available:', err.message));

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