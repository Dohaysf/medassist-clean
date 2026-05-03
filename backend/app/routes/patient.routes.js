const express = require('express');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user.userId }, '-__v').sort({ createdAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/eso', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user.userId })
      .select('esoSummary createdAt')
      .sort({ createdAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/attach-conversation', auth, async (req, res) => {
  console.log('📩 Attach conversation appelé');
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });
    const conversation = await Conversation.findOne({ sessionId, userId: null });
    if (!conversation) return res.status(404).json({ error: 'Conversation anonyme non trouvée' });
    conversation.userId = req.user.userId;
    conversation.tempUserId = null;
    await conversation.save();
    res.json({ message: 'Conversation rattachée avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;