const authService = require("./auth.service");
const validators = require("./auth.validator");
const asyncHandler = require("../../utils/asyncHandler");
const apiResponse = require("../../utils/apiResponse");
const User = require("../users/user.model");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

const authController = {
  register: asyncHandler(async (req, res) => {
    const { error, value } = validators.register.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const user = await authService.register(value);

    return apiResponse.success(
      res,
      "Registration successful",
      {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      },
      201,
    );
  }),

  login: asyncHandler(async (req, res) => {
    const { error, value } = validators.login.validate(req.body);
    if (error) return apiResponse.error(res, error.details[0].message, 400);

    const deviceInfo = req.headers["user-agent"] || "unknown";
    const { user, accessToken, refreshToken } = await authService.login(
      value.email,
      value.password,
      deviceInfo,
    );

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

    return apiResponse.success(res, "Login successful", {
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  }),

  profile: asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate({
      path: "roles",
      select: "name displayName",
    });

    return apiResponse.success(res, "User profile", {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.roles.map((role) => ({
          name: role.name,
          displayName: role.displayName,
        })),
        permissions: user.permissionsCache,
      },
    });
  }),

  refresh: asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return apiResponse.error(res, "No refresh token provided", 401);

    const { accessToken, refreshToken } = await authService.refresh(token);

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

    return apiResponse.success(res, "Token refreshed", { accessToken });
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken, req.user._id);
    }

    res.clearCookie("refreshToken");
    return apiResponse.success(res, "Logged out successfully");
  }),

  logoutAll: asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user._id);

    res.clearCookie("refreshToken");
    return apiResponse.success(res, "Logged out from all devices");
  }),
};

module.exports = authController;
