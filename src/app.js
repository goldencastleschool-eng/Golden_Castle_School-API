const express = require('express');
const cors = require('cors');
const app = express();
const { createCache } = require("./middleware/cacheMiddleware");
const { createRateLimit } = require("./middleware/rateLimitMiddleware");

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
const reportRoutes = require("./routes/reportRoutes");
const busManagementRoutes = require("./routes/busManagementRoutes");
const payrollRoutes = require("./routes/payrollRoutes");

const defaultClientOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://golden-castle-school.vercel.app"
];

const clientOrigins = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  defaultClientOrigins.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

app.use(securityHeaders);
app.set("trust proxy", 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || clientOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  exposedHeaders: ["X-Total-Count"]
}));
app.use(express.json({
  limit: "1mb"
}));

app.use(
  "/api",
  createRateLimit({
    max: Number(process.env.API_RATE_LIMIT_MAX || 300),
    windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    prefix: "api"
  })
);


app.get('/', createCache({ ttlSeconds: 300, prefix: "health" }), (req, res) => {
    res.json({ message: 'Welcome to the School Result System API' } );
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
app.use('/api/reports', reportRoutes);
app.use('/api/bus-management', busManagementRoutes);
app.use('/api/payroll', payrollRoutes);


module.exports = app;
