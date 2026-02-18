const jwt = require('jsonwebtoken');
const User = require('../modules/users/user.model');
const env = require('../config/env');
const apiResponse = require('../utils/apiResponse');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return apiResponse.error(res, 'No token provided or Invalid token', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.accessSecret);

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return apiResponse.error(res, 'User not found or inactive', 401);
    }

    // console.log('Decoded token:', decoded);
    // console.log('User tokenVersion:', user.tokenVersion);

    if (decoded.tokenVersion !== user.tokenVersion) {
      return apiResponse.error(res, 'Session expired, please login again', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;