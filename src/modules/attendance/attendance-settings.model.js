const mongoose = require('mongoose');

const attendanceSettingsSchema = new mongoose.Schema({
  workStartTime:    { type: String, default: '09:00' }, // HH:mm
  workEndTime:      { type: String, default: '17:00' }, // HH:mm
  graceMinutes:     { type: Number, default: 15       }, // late threshold
  workingDays:      { type: [Number], default: [1,2,3,4,5] }, // 0=Sun, 1=Mon...
  requireLocation:  { type: Boolean, default: true    },
  locationRadius:   { type: Number,  default: 100     }, // meters from office
  officeLocation: {
    lat:     { type: Number },
    lng:     { type: Number },
    address: { type: String }
  },
  allowRemote:      { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('AttendanceSettings', attendanceSettingsSchema);