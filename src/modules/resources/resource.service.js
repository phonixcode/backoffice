const Resource = require("./resource.model");
const Permission = require("../permissions/permission.model");
const Role = require("../roles/role.model");
const User = require("../users/user.model");

const DEFAULT_ACTIONS = ["create", "read", "update", "delete", "list"];

async function grantToSuperAdmin(permissionIds) {
  const superAdminRole = await Role.findOne({ name: "super_admin" });
  if (!superAdminRole) return;

  // merge new permissions into super admin role — no duplicates
  const existing = superAdminRole.permissions.map((p) => p.toString());
  const incoming = permissionIds.map((p) => p.toString());
  const merged = [...new Set([...existing, ...incoming])];

  superAdminRole.permissions = merged;
  await superAdminRole.save();

  // resync all users that have the super_admin role
  const users = await User.find({ roles: superAdminRole._id });
  await Promise.all(
    users.map(async (user) => {
      const allPermissions = await Permission.find({
        _id: { $in: merged },
        isActive: true,
      });
      user.permissionsCache = [
        ...new Set([
          ...user.permissionsCache,
          ...allPermissions.map((p) => p.name),
        ]),
      ];
      await user.save();
    }),
  );
}

const resourceService = {
  async createResource(data) {
    const { name, displayName, description } = data;

    const resource = await Resource.create({
      name: name.toLowerCase(),
      displayName,
      description,
    });

    // auto-generate CRUD permissions
    const permissions = DEFAULT_ACTIONS.map((action) => ({
      resource: resource._id,
      resourceName: resource.name,
      action,
      name: `${resource.name}:${action}`,
      type: "crud",
      description: `${action} ${resource.displayName}`,
    }));

    const created = await Permission.insertMany(permissions);

    await grantToSuperAdmin(created.map((p) => p._id));

    return resource;
  },

  async getAllResources() {
    return Resource.find({ isActive: true }).sort({ createdAt: -1 });
  },

  async getResourceWithPermissions(resourceId) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      const error = new Error("Resource not found");
      error.statusCode = 404;
      throw error;
    }

    const permissions = await Permission.find({
      resource: resourceId,
      isActive: true,
    });

    return { resource, permissions };
  },

  async addCustomPermission(resourceId, action, description) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      const error = new Error("Resource not found");
      error.statusCode = 404;
      throw error;
    }

    const exists = await Permission.findOne({
      resource: resourceId,
      action: action.toLowerCase(),
    });
    if (exists) {
      const error = new Error(
        `Permission "${resource.name}:${action}" already exists`,
      );
      error.statusCode = 409;
      throw error;
    }

    const permission = await Permission.create({
      resource: resource._id,
      resourceName: resource.name,
      action: action.toLowerCase(),
      name: `${resource.name}:${action.toLowerCase()}`,
      type: "custom",
      description,
    });

    await grantToSuperAdmin([permission._id]);

    return permission;
  },

  async deleteResource(resourceId) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      const error = new Error("Resource not found");
      error.statusCode = 404;
      throw error;
    }

    if (resource.isSystem) {
      const error = new Error(`"${resource.name}" is a system resource and cannot be deleted`);
      error.statusCode = 403;
      throw error;
    }

    const permissions = await Permission.find({ resource: resourceId });
    const permissionIds = permissions.map((p) => p._id);

    await Role.updateMany(
      { permissions: { $in: permissionIds } },
      { $pull: { permissions: { $in: permissionIds } } },
    );

    await Permission.deleteMany({ resource: resourceId });
    await Resource.findByIdAndUpdate(resourceId, { isActive: false });

    await resourceService.syncAffectedUsers(permissions.map((p) => p.name));
  },

  async syncAffectedUsers(permissionNames) {
    const users = await User.find({
      permissionsCache: { $in: permissionNames },
    });

    await Promise.all(
      users.map(async (user) => {
        user.permissionsCache = user.permissionsCache.filter(
          (p) => !permissionNames.includes(p),
        );
        await user.save();
      }),
    );
  },
};

module.exports = resourceService;
