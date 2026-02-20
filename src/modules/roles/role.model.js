const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  isDefault: {
    type: Boolean,
    default: false 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

roleSchema.index({ isDefault: 1 });
roleSchema.index({ permissions: 1 });

module.exports = mongoose.model('Role', roleSchema);