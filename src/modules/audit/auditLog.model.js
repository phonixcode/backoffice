const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  performedBy: {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email:    { type: String },
    fullName: { type: String }
  },

  action:     { type: String, required: true },
  resource:   { type: String, required: true },
  permission: { type: String },

  request: {
    method:  { type: String },
    url:     { type: String },
    body:    { type: mongoose.Schema.Types.Mixed },
    params:  { type: mongoose.Schema.Types.Mixed },
    query:   { type: mongoose.Schema.Types.Mixed }
  },

  response: {
    statusCode: { type: Number },
    success:    { type: Boolean }
  },

  // device info
  device: {
    userAgent: { type: String },
    browser: {
      name:    { type: String },
      version: { type: String }
    },
    os: {
      name:    { type: String },
      version: { type: String }
    },
    device: {
      type:   { type: String },  // mobile, tablet, desktop
      vendor: { type: String },
      model:  { type: String }
    }
  },

  // location info
  location: {
    ip:       { type: String },
    country:  { type: String },
    region:   { type: String },
    city:     { type: String },
    timezone: { type: String },
    ll:       [{ type: Number }]  // [latitude, longitude]
  },

  status: {
    type: String,
    enum: ['success', 'failed', 'forbidden'],
    required: true
  },

  isSuspicious:     { type: Boolean, default: false },
  suspiciousReasons: [{ type: String }],

  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// auto-delete after 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

auditLogSchema.index({ 'performedBy.userId': 1 });
auditLogSchema.index({ 'location.country': 1 });
auditLogSchema.index({ 'location.ip': 1 });
auditLogSchema.index({ resource: 1 });
auditLogSchema.index({ status: 1 });
auditLogSchema.index({ isSuspicious: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);