const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../users/user.model");
const RefreshToken = require("./refreshToken.model");
const env = require("../../config/env");
const Role = require("../roles/role.model");
const Permission = require("../permissions/permission.model");

const authService = {
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        tokenVersion: user.tokenVersion,
      },
      env.jwt.accessSecret,
      { expiresIn: env.jwt.accessExpiresIn },
    );
  },

  generateRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
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
      const error = new Error("Email already in use");
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
      permissionsCache: [],
    });

    if (defaultRole) {
      const permissions = await Permission.find({
        _id: { $in: defaultRole.permissions },
        isActive: true,
      });
      user.permissionsCache = permissions.map((p) => p.name);
      await user.save();
    }

    return user;
  },

  async login(email, password, deviceInfo) {
    const user = await User.findOne({ email, isActive: true }).select(
      "+password +loginAttempts +lockUntil",
    );

    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      const error = new Error(
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s)`,
      );
      error.statusCode = 423;
      throw error;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // increment failed attempts
      await user.incrementLoginAttempts();

      const attemptsLeft = 5 - (user.loginAttempts + 1);
      const error = new Error(
        attemptsLeft > 0
          ? `Invalid email or password — ${attemptsLeft} attempt(s) remaining`
          : "Account locked due to too many failed attempts. Try again in 30 minutes",
      );
      error.statusCode = 401;
      throw error;
    }

    // successful login — reset attempts
    await user.resetLoginAttempts();

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    await this.saveRefreshToken(user._id, refreshToken, deviceInfo);

    return { user, accessToken, refreshToken };
  },

  async forgotPassword(email) {
    const user = await User.findOne({ email, isActive: true });

    if (!user) return;

    // generate secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    // send reset email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;

    await sendMail({
      to: user.email,
      subject: "Password Reset Request — BackOffice NG",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${user.firstName},</p>
        <p>You requested a password reset. Click the button below to reset your password.</p>
        <p>This link expires in <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block; padding:12px 24px; background:#2563eb;
                  color:#fff; text-decoration:none; border-radius:6px; margin:16px 0;">
          Reset Password
        </a>
        <p>If you did not request this, please ignore this email. Your password will remain unchanged.</p>
        <p>For security, never share this link with anyone.</p>
      </div>
    `,
    });
  },

  async resetPassword(rawToken, newPassword) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      const error = new Error("Invalid or expired reset token");
      error.statusCode = 400;
      throw error;
    }

    // set new password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    user.tokenVersion += 1;
    await user.save();

    await RefreshToken.deleteMany({ userId: user._id });
  },

  async refresh(token) {
    const stored = await RefreshToken.findOne({ token });

    if (!stored) {
      const error = new Error("Invalid refresh token");
      error.statusCode = 401;
      throw error;
    }

    if (stored.expiresAt < new Date()) {
      await stored.deleteOne();
      const error = new Error("Refresh token expired, please login again");
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(stored.userId);
    if (!user || !user.isActive) {
      const error = new Error("User not found or inactive");
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
  },
};

module.exports = authService;
