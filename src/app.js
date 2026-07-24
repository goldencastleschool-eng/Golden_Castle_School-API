const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const app = express();
const { createCache } = require("./middleware/cacheMiddleware");
const { createRateLimit } = require("./middleware/rateLimitMiddleware");
const redisStore = require("./utils/upstashRedis");

const studentRoutes = require("./routes/studentRoutes");
const classRoutes = require("./routes/classRoutes");
const authRoutes = require("./routes/authRoutes");
const resultRoutes = require("./routes/resultRoutes");
const cumulativeResultRoutes = require("./routes/cumulativeResultRoutes");
const resultAccessRoutes = require("./routes/resultAccessRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const classBroadsheetRoutes = require("./routes/classBroadsheetRoutes");
const classResultRoutes = require("./routes/classResultRoutes");
const feeRoutes = require("./routes/feeRoutes");
const feeStructureRoutes = require("./routes/feeStructureRoutes");
const portalVisibilityRoutes = require("./routes/portalVisibilityRoutes");
const portalNoticeRoutes = require("./routes/portalNoticeRoutes");
const reportRoutes = require("./routes/reportRoutes");
const busManagementRoutes = require("./routes/busManagementRoutes");
const boardingManagementRoutes = require("./routes/boardingManagementRoutes");
const payrollRoutes = require("./routes/payrollRoutes");

const defaultClientOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://golden-castle-school.vercel.app",
  "https://www.goldencastleschool.com",
  "https://goldencastleschool.com",
  "https://portal.goldencastleschool.com",
  "https://portal.goldencastle.com"
];

const clientOrigins = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedClientOrigins = Array.from(
  new Set([
    ...defaultClientOrigins,
    ...clientOrigins
  ])
);

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

const mongoStates = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

const getServiceStatus = () => {
  const mongoState = mongoose.connection.readyState;

  return {
    status: mongoState === 1 ? "ready" : "degraded",
    uptime_seconds: Math.round(process.uptime()),
    mongo: {
      state: mongoStates[mongoState] || "unknown",
      ready: mongoState === 1
    },
    redis: {
      mode: redisStore.isConfigured() ? "upstash" : "memory-fallback"
    }
  };
};

app.use(securityHeaders);
app.set("trust proxy", 1);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedClientOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposedHeaders: ["X-Total-Count"]
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({
  limit: "1mb"
}));

app.use(
  "/api",
  createRateLimit({
    max: Number(process.env.API_RATE_LIMIT_MAX || 1000),
    windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    prefix: "api"
  })
);


app.get('/', createCache({ ttlSeconds: 300, prefix: "health" }), (req, res) => {
    res.json({ message: 'Welcome to the School Result System API' } );
});

app.get("/healthz", (req, res) => {
  res.json({
    status: "ok",
    uptime_seconds: Math.round(process.uptime())
  });
});

app.get("/readyz", (req, res) => {
  const status = getServiceStatus();
  res.status(status.status === "ready" ? 200 : 503).json(status);
});


app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/cumulative-results', cumulativeResultRoutes);
app.use('/api/result-access', resultAccessRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/class-broadsheets', classBroadsheetRoutes);
app.use('/api/class-results', classResultRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/fee-structures', feeStructureRoutes);
app.use('/api/portal-visibility', portalVisibilityRoutes);
app.use('/api/portal-notices', portalNoticeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bus-management', busManagementRoutes);
app.use('/api/boarding-management', boardingManagementRoutes);
app.use('/api/payroll', payrollRoutes);


module.exports = app;
