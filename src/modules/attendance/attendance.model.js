const mongoose = require('mongoose');

const coordinatesSchema = new mongoose.Schema({
  lat:      { type: Number, required: true },
  lng:      { type: Number, required: true },
  accuracy: { type: Number },
  address:  { type: String }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Employee',
    required: true,
    index:    true
  },
  date: {
    type:     Date,
    required: true,
    index:    true
  },
  clockIn: {
    time:     { type: Date, required: true },
    location: coordinatesSchema,
    ip:       { type: String },
    device:   { type: String }
  },
  clockOut: {
    time:     { type: Date },
    location: coordinatesSchema,
    ip:       { type: String },
    device:   { type: String }
  },
  duration:       { type: Number, default: 0 },  // minutes
  overtimeMinutes:{ type: Number, default: 0 },
  status: {
    type:    String,
    enum:    ['present', 'late', 'absent', 'half_day', 'on_leave'],
    default: 'present',
    index:   true
  },
  isLate:         { type: Boolean, default: false },
  lateByMinutes:  { type: Number,  default: 0 },
  notes:          { type: String },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User'
  }
}, {
  timestamps: true
});

// compound index for common queries
attendanceSchema.index({ employee: 1, date: -1 });
attendanceSchema.index({ date: -1, status: 1 });

// calculate duration on save
attendanceSchema.pre('save', function (next) {
  if (this.clockIn?.time && this.clockOut?.time) {
    const diff    = new Date(this.clockOut.time) - new Date(this.clockIn.time);
    this.duration = Math.round(diff / 60000); // convert to minutes

    const standardDay    = 8 * 60; // 480 minutes
    this.overtimeMinutes = Math.max(0, this.duration - standardDay);
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);