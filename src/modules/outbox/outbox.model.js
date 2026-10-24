const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true },
  eventType:  { type: String, required: true },
  channel: {
    type: String,
    enum: ['notification', 'email'],
    required: true
  },
  aggregate: {
    type: { type: String, required: true },
    id:   { type: mongoose.Schema.Types.Mixed, required: true }
  },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'queued', 'delivered', 'failed'],
    default: 'pending'
  },
  attempts:      { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedUntil:   { type: Date },
  queuedAt:      { type: Date },
  lastError:     { type: String },
  deliveredAt:   { type: Date }
}, { timestamps: true });

outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });
outboxEventSchema.index({ status: 1, lockedUntil: 1 });
outboxEventSchema.index({ 'aggregate.type': 1, 'aggregate.id': 1 });

module.exports = mongoose.model('OutboxEvent', outboxEventSchema);
