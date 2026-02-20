const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  period: {
    month: { type: Number, required: true },  // 1-12
    year:  { type: Number, required: true }
  },
  basicSalary:  { type: Number, required: true },
  allowances: [{
    name:   { type: String },
    amount: { type: Number }
  }],
  deductions: [{
    name:   { type: String },
    amount: { type: Number }
  }],
  grossPay:  { type: Number, required: true },
  netPay:    { type: Number, required: true },
  currency:  { type: String, default: 'USD' },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'paid'],
    default: 'draft'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paidAt: { type: Date },
  notes:  { type: String, trim: true }
}, { timestamps: true });

// one payroll record per employee per month
payrollSchema.index(
  { employee: 1, 'period.month': 1, 'period.year': 1 },
  { unique: true }
);

payrollSchema.index({ status: 1 });
payrollSchema.index({ 'period.year': 1, 'period.month': 1 });
payrollSchema.index({ employee: 1 });
payrollSchema.index({ processedBy: 1 });
payrollSchema.index({ approvedBy: 1 });
payrollSchema.index({ status: 1, 'period.year': 1, 'period.month': 1 });
payrollSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);