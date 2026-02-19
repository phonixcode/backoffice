const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  head: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'  // department head is an employee
  },
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'  // supports nested departments e.g Engineering > Frontend
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

departmentSchema.index({ isActive: 1 });
departmentSchema.index({ head: 1 });
departmentSchema.index({ parentDepartment: 1 });

module.exports = mongoose.model('Department', departmentSchema);