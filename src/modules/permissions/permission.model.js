const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  resource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    required: true
  },
  resourceName: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    unique: true, 
    lowercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['crud', 'custom'],
    default: 'crud'
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

permissionSchema.index({ resource: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('Permission', permissionSchema);