require("dotenv").config(); // reload env - 2026-02-19
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const db = require("./config/database");
const { runOptimizations } = require("./config/migrations");

const app = express();
const PORT = process.env.PORT || 5000;

// ====================================
// MIDDLEWARE
// ====================================

// Trust proxy (for rate limiting behind Vercel/Railway proxies)
app.set("trust proxy", 1);

// Security headers + CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://apis.google.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com",
          "https://ui-avatars.com",
          "https://lh3.googleusercontent.com",
        ],
        connectSrc: [
          "'self'",
          process.env.FRONTEND_URL || "http://localhost:3000",
          "https://*.vercel.app",
          "https://*.molystudio.online",
          "https://*.moli.studio",
          "wss://*",
          "ws://*",
        ],
        // Cho phép frontend nhúng PDF từ backend vào iframe
        frameAncestors: [
          "'self'",
          process.env.FRONTEND_URL || "http://localhost:3000",
        ],
        objectSrc: ["'none'"],
      },
    },
    // Tắt X-Frame-Options để không conflict với frameAncestors CSP
    frameguard: false,
  }),
);

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://csca-moli-studio.vercel.app',
  'https://molystudio.online',
  'https://www.molystudio.online',
  'https://*.molystudio.online',
  'https://moli.studio',
  'https://www.moli.studio',
  'https://*.moli.studio',
];

// Allow FRONTEND_URL env var to add extra origins ( Railway/Vercel deployments )
const extraOrigins = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);

// Dynamic origin validator: matches against allowed list, supports subdomains
const corsOriginValidator = (origin, callback) => {
  if (!origin) return callback(null, true); // allow no-origin (server-to-server)
  const allOrigins = [...ALLOWED_ORIGINS, ...extraOrigins];
  const allowed = allOrigins.some(allowed =>
    allowed === origin ||
    allowed === '*' ||
    (allowed.endsWith('.*') && new RegExp(`^${allowed.replace('.', '\\.').replace('*', '.*')}$`).test(origin))
  );
  if (allowed) return callback(null, origin);
  callback(new Error(`Origin ${origin} not allowed by CORS`));
};

app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "X-Requested-With",
    ],
  }),
);
app.use(compression()); // Compress responses
app.use(express.json({ limit: "50kb" })); // Body size limit – prevent DoS
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ====================================
// RATE LIMITING
// ====================================
const isProduction = process.env.NODE_ENV === "production";
const globalWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const globalMax = Number(process.env.RATE_LIMIT_MAX || (isProduction ? 400 : 5000));

// Global limiter: broad protection for all API routes.
const globalLimiter = rateLimit({
  windowMs: globalWindowMs,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
  },
});

const authWindowMs = Number(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
);
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX || (isProduction ? 40 : 400));

// Strict auth limiter: only for brute-force sensitive auth endpoints.
const authLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu xác thực, vui lòng thử lại sau 15 phút",
  },
  skipSuccessfulRequests: true, // only count failed requests
});

app.use("/api", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/verify-email", authLimiter);

// ====================================
// ROUTES
// ====================================
app.get("/", (req, res) => {
  res.json({
    message: "CSCA API Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      posts: "/api/posts",
      exams: "/api/exams",
      stats: "/api/stats",
      materials: "/api/materials",
      vocabulary: "/api/vocabulary",
    },
  });
});

// Health check
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch {
    // Don't expose DB error details publicly
    res.status(503).json({ status: "unhealthy" });
  }
});

// ====================================
// API ROUTES
// ====================================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api", require("./routes/exams"));
app.use("/api", require("./routes/upload"));
app.use("/api/subjects", require("./routes/subjects"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin/exams", require("./routes/adminExamRoutes"));
app.use("/api/admin/images", require("./routes/imageRoutes"));
app.use("/api/admin/forum", require("./routes/adminForumRoutes"));
app.use("/api/admin/roadmap", require("./routes/adminRoadmapRoutes"));
app.use("/api/admin/vip", require("./routes/adminVipRoutes"));
app.use("/api/admin/qa", require("./routes/adminQaRoutes")); // Admin QA
app.use("/api/materials", require("./routes/materials"));
app.use("/api/vocabulary", require("./routes/vocabulary"));
app.use("/api/search", require("./routes/search")); // Global search
app.use("/api/stats", require("./routes/stats")); // Public stats (C8)
app.use("/api/leaderboard", require("./routes/leaderboard")); // Leaderboard
app.use("/api/settings", require("./routes/settings")); // Site settings (exam date)
app.use("/api/ai", require("./routes/ai")); // AI Analysis
app.use("/api/insights", require("./routes/insights")); // Learning Insights
app.use("/api/notifications", require("./routes/notifications")); // Notifications
app.use("/api/payments", require("./routes/payments")); // MoMo & Payments
app.use("/api/vip", require("./routes/vipPackageRoutes")); // VIP Packages
app.use("/api/coupons", require("./routes/couponRoutes")); // Coupons (validate & apply)
app.use("/api/admin/coupons", require("./routes/adminCouponRoutes")); // Admin Coupon Management
app.use("/api/qa", require("./routes/qaRoutes")); // Q&A for Users
app.use("/api/messages", require("./routes/messages")); // Private messaging
app.use("/api/users", require("./routes/userProfile")); // Public user profiles
app.use("/api/users", require("./routes/userActions")); // Block/Report actions

// ====================================
// ERROR HANDLING
// ====================================
// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not Found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ====================================
// SOCKET.IO
// ====================================
let io = null;
try {
  const { initSocket } = require('./socket');
  const httpServer = http.createServer(app);
  io = initSocket(httpServer);
  const { setIO } = require('./socket/singleton');
  setIO(io);
  console.log('✅ Socket.io initialized');

  // ====================================
  // START SERVER
  // ====================================
  httpServer.listen(PORT, async () => {
    console.log(`
╔════════════════════════════════════════╗
║     CSCA API Server Started            ║
╠════════════════════════════════════════╣
║  Port:        ${PORT}                     ║
║  Environment: ${process.env.NODE_ENV || "development"}            ║
║  Database:    ${process.env.DB_NAME || "csca_db"}                ║
║  Socket.io:   Enabled                 ║
╚════════════════════════════════════════╝
  `);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}/`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);

    await runOptimizations();
  });

  // Make io accessible to routes via app.locals
  app.locals.io = io;
} catch (err) {
  console.warn('⚠️  Socket.io failed to initialize, falling back to HTTP-only mode:', err.message);
  app.listen(PORT, async () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    await runOptimizations();
  });
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

module.exports = app;
