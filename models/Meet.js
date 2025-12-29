const mongoose = require('mongoose');

const meetSchema = new mongoose.Schema({
  meetId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    default: 'Video Meeting'
  },
  description: {
    type: String,
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  }
});

// Indexlar
meetSchema.index({ meetId: 1 });
meetSchema.index({ creator: 1 });
meetSchema.index({ participants: 1 });
meetSchema.index({ isActive: 1 });
meetSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Meet', meetSchema);
