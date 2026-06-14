const express = require('express');
const cors = require('cors');
const app = express();

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

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

app.use(securityHeaders);
app.use(cors({
  origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://golden-castle-school.vercel.app",
    ],
  credentials: true
}));
app.use(express.json({
  limit: "1mb"
}));



app.get('/', (req, res) => {
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


module.exports = app;
