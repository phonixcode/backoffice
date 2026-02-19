const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middleware/errorHandler');
const responseTime = require('./middleware/responseTime');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(responseTime);

app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.use('/api/v1', require('./routes/v1/api'));

app.use(errorHandler);

module.exports = app;