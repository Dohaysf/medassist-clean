const express = require('express');
const router = express.Router();
const { handleChat, resetChatSession, cleanupSessions, getUserHistory } = require('../controllers/chatController');
const { escaladeUrgence } = require('../services/processMessageGroq');
const auth = require('../middleware/auth');

// Route normale de chat
router.post('/', handleChat);

// Route pour réinitialiser une session
router.post('/reset-session', resetChatSession);

// Route pour déclenchement manuel de l'urgence
router.post('/emergency-manual', async (req, res) => {
  try {
    const { sessionId, summary } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId requis' });
    }
    const result = await escaladeUrgence(summary || {}, sessionId, "Déclenchement manuel par bouton");
    res.json({ success: true, reply: result.reply });
  } catch (error) {
    console.error('Erreur urgence manuelle:', error);
    res.status(500).json({ error: 'Erreur lors de l’alerte' });
  }
});

// ROUTE : Récupérer l'historique de l'utilisateur connecté
router.get('/history', auth, getUserHistory);

// ROUTE : Sauvegarder une conversation (avec mise à jour si existe)
router.post('/save-session', auth, async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    const userId = req.user.userId || req.user.id;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId requis' });
    }
    
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Aucun message à sauvegarder' });
    }
    
    const Conversation = require('../models/Conversation');
    
    // Transformer les messages
    const formattedMessages = messages.map(msg => ({
      sender: msg.role === 'user' || msg.sender === 'user' ? 'user' : 'bot',
      text: msg.content || msg.text,
      timestamp: new Date()
    }));
    
    // Mettre à jour ou créer
    const conversation = await Conversation.findOneAndUpdate(
      { userId, sessionId },
      {
        $set: {
          messages: formattedMessages,
          title: formattedMessages[0]?.text?.substring(0, 50) || 'Consultation médicale',
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId,
          sessionId,
          createdAt: new Date(),
          esoSummary: {}
        }
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Conversation sauvegardée/mise à jour - User: ${userId}, Session: ${sessionId}`);
    
    res.json({ 
      success: true, 
      message: 'Conversation sauvegardée avec succès',
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Erreur sauvegarde session:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour nettoyer les sessions inactives (admin uniquement)
router.post('/cleanup-sessions', auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Accès réservé aux managers' });
    }
    await cleanupSessions(req, res);
  } catch (error) {
    console.error('Erreur nettoyage sessions:', error);
    res.status(500).json({ error: 'Erreur lors du nettoyage' });
  }
});

module.exports = router;