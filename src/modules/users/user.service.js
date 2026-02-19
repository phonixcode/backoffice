const User = require("./user.model");
const Role = require("../roles/role.model");
const Permission = require("../permissions/permission.model");
const { paginate, paginationMeta } = require("../../utils/paginate");

const userService = {
  async getAllUsers(query = {}) {
    const { page, limit, skip } = paginate(query, 100);

    const filter = {};
    if (query.search) {
      filter.$or = [
        { firstName: { $regex: query.search, $options: "i" } },
        { lastName: { $regex: query.search, $options: "i" } },
        { email: { $regex: query.search, $options: "i" } },
      ];
    }
    if (query.role) filter.roles = query.role;
    if (query.isActive !== undefined)
      filter.isActive = query.isActive === "true";

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .populate("roles", "name displayName")
        .select("-permissionsCache -directPermissions")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { users, pagination: paginationMeta(total, page, limit) };
  },

  async getUser(userId) {
    const user = await User.findById(userId)
      .populate("roles", "name displayName description")
      .populate("directPermissions", "name action resourceName type");

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return user;
  },

  async createUser(data) {
    const { firstName, lastName, email, password, roles = [] } = data;

    const existing = await User.findOne({ email });
    if (existing) {
      const error = new Error("Email already in use");
      error.statusCode = 409;
      throw error;
    }

    if (roles.length) {
      const found = await Role.countDocuments({
        _id: { $in: roles },
        isActive: true,
      });
      if (found !== roles.length) {
        const error = new Error("One or more roles are invalid");
        error.statusCode = 400;
        throw error;
      }
    }

    // if no roles provided pick up default role
    let assignedRoles = roles;
    if (!assignedRoles.length) {
      const defaultRole = await Role.findOne({
        isDefault: true,
        isActive: true,
      });
      if (defaultRole) assignedRoles = [defaultRole._id];
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      roles: assignedRoles,
    });

    await userService.rebuildUserCache(user);

    return userService.getUser(user._id);
  },

  async updateUser(userId, data) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // if email is changing check it's not taken
    if (data.email && data.email !== user.email) {
      const exists = await User.findOne({ email: data.email });
      if (exists) {
        const error = new Error("Email already in use");
        error.statusCode = 409;
        throw error;
      }
    }

    const allowedFields = ["firstName", "lastName", "email"];
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) user[field] = data[field];
    });

    await user.save();
    return userService.getUser(userId);
  },

  async assignRoles(userId, roleIds) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const found = await Role.countDocuments({
      _id: { $in: roleIds },
      isActive: true,
    });
    if (found !== roleIds.length) {
      const error = new Error("One or more roles are invalid");
      error.statusCode = 400;
      throw error;
    }

    user.roles = roleIds;
    await user.save();

    await userService.rebuildUserCache(user);

    return userService.getUser(userId);
  },

  async addDirectPermissions(userId, permissionIds) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const found = await Permission.countDocuments({
      _id: { $in: permissionIds },
      isActive: true,
    });
    if (found !== permissionIds.length) {
      const error = new Error("One or more permissions are invalid");
      error.statusCode = 400;
      throw error;
    }

    // merge with existing direct permissions — no duplicates
    const existing = user.directPermissions.map((p) => p.toString());
    const merged = [...new Set([...existing, ...permissionIds])];
    user.directPermissions = merged;
    await user.save();

    await userService.rebuildUserCache(user);

    return userService.getUser(userId);
  },

  async removeDirectPermission(userId, permissionId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.directPermissions = user.directPermissions.filter(
      (p) => p.toString() !== permissionId,
    );
    await user.save();

    await userService.rebuildUserCache(user);
    return userService.getUser(userId);
  },

  async toggleUserStatus(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    user.isActive = !user.isActive;
    await user.save();

    return {
      isActive: user.isActive,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
    };
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      const error = new Error("Current password is incorrect");
      error.statusCode = 400;
      throw error;
    }

    user.password = newPassword;
    // increment tokenVersion to invalidate all existing sessions
    // forces user to login again on all devices after password change
    user.tokenVersion += 1;
    await user.save();
  },

  async rebuildUserCache(user) {
    const roles = await Role.find({
      _id: { $in: user.roles },
      isActive: true,
    }).populate({
      path: "permissions",
      match: { isActive: true },
    });

    const fromRoles = roles.flatMap((r) => r.permissions.map((p) => p.name));

    const directPerms = await Permission.find({
      _id: { $in: user.directPermissions },
      isActive: true,
    });
    const fromDirect = directPerms.map((p) => p.name);

    user.permissionsCache = [...new Set([...fromRoles, ...fromDirect])];
    await user.save();

    return user.permissionsCache;
  },
};

module.exports = userService;
