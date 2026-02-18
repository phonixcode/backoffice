const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true 
  },
  employeeId: {
    type: String,
    unique: true,
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  jobTitle: {
    type: String,
    trim: true,
    required: [true, 'Job title is required']
  },
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'intern'],
    default: 'full_time'
  },
  employmentStatus: {
    type: String,
    enum: ['active', 'suspended', 'terminated', 'resigned'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date  // set when employment ends
  },
  salary: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    frequency: {
      type: String,
      enum: ['monthly', 'weekly', 'biweekly'],
      default: 'monthly'
    }
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// auto-generate employeeId before saving
employeeSchema.pre('save', async function (next) {
  if (!this.isNew) return next();

  const count = await mongoose.model('Employee').countDocuments();
  this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  next();
});

// employeeSchema.index({ user: 1 });
employeeSchema.index({ department: 1 });
// employeeSchema.index({ employeeId: 1 });

module.exports = mongoose.model('Employee', employeeSchema);