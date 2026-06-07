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


module.exports = app;
