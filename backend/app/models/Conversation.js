const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'bot'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
    index: true
  },
  sessionId: {
    type: String,
    required: true
  },
  messages: [messageSchema],
  esoSummary: { type: Object, default: {} },
  intent: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  title: { type: String, default: 'Consultation médicale' },
  tempUserId: { type: String, index: true }
});

// Index composé unique (userId + sessionId)
conversationSchema.index({ userId: 1, sessionId: 1 }, { unique: true, sparse: true });
// Index pour les recherches par date
conversationSchema.index({ userId: 1, createdAt: -1 });
// Index pour les sessions anonymes
conversationSchema.index({ tempUserId: 1, createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);