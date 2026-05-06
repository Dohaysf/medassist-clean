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

// ✅ ROUTE PUBLIQUE : Récupérer l'historique (sans auth pour les non connectés)
router.get('/public/history', async (req, res) => {
  try {
    // Pour les utilisateurs non connectés, retourner un tableau vide
    // ou récupérer par sessionId si besoin
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      const Conversation = require('../models/Conversation');
      const conv = await Conversation.findOne({ sessionId }).sort({ updatedAt: -1 });
      if (conv) {
        return res.json([{
          id: conv._id,
          sessionId: conv.sessionId,
          date: conv.updatedAt ? new Date(conv.updatedAt).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR'),
          title: conv.title || 'Consultation médicale',
          preview: conv.messages?.[0]?.text?.substring(0, 100) || 'Aucun message',
          messageCount: conv.messages?.length || 0,
          urgency: conv.messages?.some(m => m.text?.includes('URGENCE')) || false
        }]);
      }
    }
    res.json([]);
  } catch (error) {
    console.error('Erreur récupération historique public:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ROUTE : Récupérer l'historique de l'utilisateur connecté
router.get('/history', auth, getUserHistory);

// ROUTE : Supprimer une conversation spécifique
router.delete('/history/:id', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    const Conversation = require('../models/Conversation');
    
    const result = await Conversation.findOneAndDelete({ _id: id, userId });
    
    if (!result) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }
    
    console.log(`🗑️ Conversation ${id} supprimée pour user ${userId}`);
    res.json({ success: true, message: 'Conversation supprimée' });
  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ROUTE : Supprimer TOUTES les conversations de l'utilisateur
router.delete('/history/all', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const Conversation = require('../models/Conversation');
    
    const result = await Conversation.deleteMany({ userId });
    
    console.log(`🗑️ ${result.deletedCount} conversations supprimées pour user ${userId}`);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Erreur suppression totale:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ROUTE : Sauvegarder une conversation
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
    
    const formattedMessages = messages.map(msg => ({
      sender: msg.role === 'user' || msg.sender === 'user' ? 'user' : 'bot',
      text: msg.content || msg.text,
      timestamp: new Date()
    }));
    
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
    
    console.log(`✅ Conversation sauvegardée - User: ${userId}, Session: ${sessionId}`);
    
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