const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const cookieParser   = require('cookie-parser');
const hpp            = require('hpp');
const errorHandler   = require('./middleware/errorHandler');
const auditLogger    = require('./middleware/auditLogger');
const responseTime   = require('./middleware/responseTime');
const { globalLimiter } = require('./middleware/rateLimiter');
const sanitize = require('./middleware/sanitize');

const app = express();

// security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// rate limiting
app.use(globalLimiter);

// request logging
app.use(morgan("dev"));
app.use(responseTime);

// body parsing with size limits
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(sanitize);

app.use(
  hpp({
    whitelist: ["status", "type", "department"],
  }),
);

app.use("/", require("./routes/index"));

app.use(errorHandler);

module.exports = app;
