const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  type: {
    type: String,
    enum: ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  days: {
    type: Number, 
    default: 0
  },
  reason: {
    type: String,
    trim: true,
    required: [true, 'Reason is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNote: {
    type: String,
    trim: true
  },
  reviewedAt: { type: Date }
}, { timestamps: true });

// auto-calculate days before saving
leaveSchema.pre('save', function (next) {
  if (this.isModified('startDate') || this.isModified('endDate')) {
    const diff = this.endDate - this.startDate;
    this.days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }
  next();
});

leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ type: 1 });
leaveSchema.index({ employee: 1 });
leaveSchema.index({ reviewedBy: 1 });
leaveSchema.index({ employee: 1, type: 1 });
leaveSchema.index({ status: 1, createdAt: -1 });
leaveSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Leave', leaveSchema);