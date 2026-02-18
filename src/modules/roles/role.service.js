const Role = require("./role.model");
const Permission = require("../permissions/permission.model");
const User = require("../users/user.model");

const PROTECTED_ROLES = ["super_admin"];

const roleService = {
  async createRole(data) {
    const { name, displayName, description, permissions, isDefault } = data;

    if (permissions?.length) {
      const found = await Permission.countDocuments({
        _id: { $in: permissions },
        isActive: true,
      });
      if (found !== permissions.length) {
        const error = new Error("One or more permissions are invalid");
        error.statusCode = 400;
        throw error;
      }
    }

    return Role.create({
      name,
      displayName,
      description,
      permissions,
      isDefault,
    });
  },

  async getAllRoles() {
    return Role.find({ isActive: true })
      .populate("permissions", "name action resourceName type")
      .sort({ createdAt: -1 });
  },

  async getRole(roleId) {
    const role = await Role.findById(roleId).populate(
      "permissions",
      "name action resourceName type description",
    );

    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }

    return role;
  },

  async updateRole(roleId, data) {
    const role = await Role.findById(roleId);
    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }

    if (PROTECTED_ROLES.includes(role.name)) {
      const error = new Error("The super_admin role cannot be modified");
      error.statusCode = 403;
      throw error;
    }

    if (data.name && data.name !== role.name) {
      const exists = await Role.findOne({ name: data.name });
      if (exists) {
        const error = new Error(`Role name "${data.name}" is already taken`);
        error.statusCode = 409;
        throw error;
      }
    }

    const allowedFields = ["name", "displayName", "description", "isDefault"];
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) role[field] = data[field];
    });

    await role.save();
    return role;
  },

  async updateRolePermissions(roleId, permissions) {
    const role = await Role.findById(roleId);
    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }

    if (PROTECTED_ROLES.includes(role.name)) {
      const error = new Error("The super_admin role cannot be modified");
      error.statusCode = 403;
      throw error;
    }

    if (permissions?.length) {
      const found = await Permission.countDocuments({
        _id: { $in: permissions },
        isActive: true,
      });
      if (found !== permissions.length) {
        const error = new Error("One or more permissions are invalid");
        error.statusCode = 400;
        throw error;
      }
    }

    role.permissions = permissions;
    await role.save();

    await roleService.syncUsersWithRole(roleId);

    return role;
  },

  async deleteRole(roleId) {
    const role = await Role.findById(roleId);
    if (!role) {
      const error = new Error("Role not found");
      error.statusCode = 404;
      throw error;
    }

    if (PROTECTED_ROLES.includes(role.name)) {
      const error = new Error("The super_admin role cannot be deleted");
      error.statusCode = 403;
      throw error;
    }

    // remove role from all users and resync their cache
    const users = await User.find({ roles: roleId });
    await Role.findByIdAndUpdate(roleId, { isActive: false });

    await Promise.all(
      users.map(async (user) => {
        user.roles = user.roles.filter(
          (r) => r.toString() !== roleId.toString(),
        );
        await roleService.rebuildUserCache(user);
      }),
    );
  },

  async rebuildUserCache(user) {
    const roles = await Role.find({
      _id: { $in: user.roles },
      isActive: true,
    }).populate("permissions");

    const fromRoles = roles.flatMap((r) => r.permissions.map((p) => p.name));

    const direct = await Permission.find({
      _id: { $in: user.directPermissions },
      isActive: true,
    });
    const fromDirect = direct.map((p) => p.name);

    user.permissionsCache = [...new Set([...fromRoles, ...fromDirect])];
    await user.save();
  },

  async syncUsersWithRole(roleId) {
    const users = await User.find({ roles: roleId });
    await Promise.all(users.map((user) => roleService.rebuildUserCache(user)));
  },
};

module.exports = roleService;
