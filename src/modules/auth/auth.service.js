const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../users/user.model');
const RefreshToken = require('./refreshToken.model');
const env = require('../../config/env');
const Role = require('../roles/role.model');
const Permission = require('../permissions/permission.model');

const authService = {
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        tokenVersion: user.tokenVersion
      },
      env.jwt.accessSecret,
      { expiresIn: env.jwt.accessExpiresIn }
    );
  },

  generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  },

  async saveRefreshToken(userId, token, deviceInfo) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return RefreshToken.create({ userId, token, deviceInfo, expiresAt });
  },

  async register(data) {
    const { firstName, lastName, email, password } = data;

    const existing = await User.findOne({ email });
    if (existing) {
      const error = new Error('Email already in use');
      error.statusCode = 409;
      throw error;
    }

    const defaultRole = await Role.findOne({ isDefault: true, isActive: true });

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      roles: defaultRole ? [defaultRole._id] : [],
      permissionsCache: [] 
    });

    if (defaultRole) {
      const permissions = await Permission.find({
        _id: { $in: defaultRole.permissions },
        isActive: true
      });
      user.permissionsCache = permissions.map(p => p.name);
      await user.save();
    }

    return user;
  },

  async login(email, password, deviceInfo) {
    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    await this.saveRefreshToken(user._id, refreshToken, deviceInfo);

    return { user, accessToken, refreshToken };
  },

  async refresh(token) {
    const stored = await RefreshToken.findOne({ token });

    if (!stored) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }

    if (stored.expiresAt < new Date()) {
      await stored.deleteOne();
      const error = new Error('Refresh token expired, please login again');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(stored.userId);
    if (!user || !user.isActive) {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }

    await stored.deleteOne();
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();
    await this.saveRefreshToken(user._id, newRefreshToken, stored.deviceInfo);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken, userId) {
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

    await RefreshToken.deleteOne({ token: refreshToken });
  },

  async logoutAll(userId) {
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });

    await RefreshToken.deleteMany({ userId });
  }
};

module.exports = authService;