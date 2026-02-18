const Resource = require('./resource.model');
const Permission = require('../permissions/permission.model');
const Role = require('../roles/role.model');
const User = require('../users/user.model');

const DEFAULT_ACTIONS = ['create', 'read', 'update', 'delete', 'list'];

const resourceService = {
  async createResource(data) {
    const { name, displayName, description } = data;

    const resource = await Resource.create({
      name: name.toLowerCase(),
      displayName,
      description
    });

    // auto-generate CRUD permissions
    const permissions = DEFAULT_ACTIONS.map(action => ({
      resource: resource._id,
      resourceName: resource.name,
      action,
      name: `${resource.name}:${action}`,
      type: 'crud',
      description: `${action} ${resource.displayName}`
    }));

    await Permission.insertMany(permissions);

    return resource;
  },

  async getAllResources() {
    return Resource.find({ isActive: true }).sort({ createdAt: -1 });
  },

  async getResourceWithPermissions(resourceId) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      const error = new Error('Resource not found');
      error.statusCode = 404;
      throw error;
    }

    const permissions = await Permission.find({
      resource: resourceId,
      isActive: true
    });

    return { resource, permissions };
  },

  async addCustomPermission(resourceId, action, description) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      const error = new Error('Resource not found');
      error.statusCode = 404;
      throw error;
    }

    const exists = await Permission.findOne({
      resource: resourceId,
      action: action.toLowerCase()
    });
    if (exists) {
      const error = new Error(`Permission "${resource.name}:${action}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    return Permission.create({
      resource: resource._id,
      resourceName: resource.name,
      action: action.toLowerCase(),
      name: `${resource.name}:${action.toLowerCase()}`,
      type: 'custom',
      description
    });
  },

  async deleteResource(resourceId) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      const error = new Error('Resource not found');
      error.statusCode = 404;
      throw error;
    }

    const permissions = await Permission.find({ resource: resourceId });
    const permissionIds = permissions.map(p => p._id);

    await Role.updateMany(
      { permissions: { $in: permissionIds } },
      { $pull: { permissions: { $in: permissionIds } } }
    );

    await Permission.deleteMany({ resource: resourceId });

    await Resource.findByIdAndUpdate(resourceId, { isActive: false });

    await resourceService.syncAffectedUsers(permissionIds);
  },

  async syncAffectedUsers(permissionIds) {
    const permissionNames = await Permission.find(
      { _id: { $in: permissionIds } },
      'name'
    );
    const names = permissionNames.map(p => p.name);

    const users = await User.find({
      permissionsCache: { $in: names }
    });

    await Promise.all(users.map(async (user) => {
      user.permissionsCache = user.permissionsCache.filter(
        p => !names.includes(p)
      );
      await user.save();
    }));
  }
};

module.exports = resourceService;