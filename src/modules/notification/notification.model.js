const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
    },

    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    resource: {
      type: String, 
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String }, 
    broadcast: { type: Boolean, default: false }, 

    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    metadata: {
       type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true },
);

// indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ role: 1, createdAt: -1 });
notificationSchema.index({ broadcast: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// auto-delete notifications older than 90 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

module.exports = mongoose.model("Notification", notificationSchema);
