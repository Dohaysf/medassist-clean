const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// ========== ROUTES SPÉCIFIQUES (doivent être avant la route dynamique) ==========

// GET /api/eso/sessions - liste toutes les sessions (pour historique et stats)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Conversation.find({}, 'sessionId esoSummary createdAt')
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/eso/history/:sessionId - récupère l'historique complet
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/eso/generate - génère le résumé (ou renvoie celui existant)
router.post('/generate', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId requis' });
    }
    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }
    res.json({ esoSummary: conversation.esoSummary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// DELETE /api/eso/clear - supprime toutes les conversations
router.delete('/clear', async (req, res) => {
  try {
    await Conversation.deleteMany({});
    res.json({ message: 'Historique effacé avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET /api/eso/:sessionId - récupère le résumé actuel depuis MongoDB
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }
    res.json({ esoSummary: conversation.esoSummary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;