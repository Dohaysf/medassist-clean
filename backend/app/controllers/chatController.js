const { processMessage } = require('../services/nlpService');
const ESOBuilder = require('../utils/esoBuilder');
const Conversation = require('../models/Conversation');
const { processMessageGroq } = require('../services/processMessageGroq');

console.log('✅ processMessageGroq importée');

// Map des sessions actives en mémoire
const sessions = new Map();

// Nettoyage automatique des sessions inactives (toutes les 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of sessions.entries()) {
        if (data.lastAccess && (now - data.lastAccess) > 3600000) {
            sessions.delete(id);
            console.log(`🧹 Session ${id} supprimée (inactive depuis >1h)`);
        }
    }
}, 600000);

const handleChat = async (req, res) => {
  try {
    const { message, sessionId, resetSession } = req.body;
    const userId = req.user?.userId || null;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message invalide' });
    }

    let id = sessionId;
    let isNewSession = false;
    
    if (resetSession || !id) {
      id = Date.now().toString();
      isNewSession = true;
      console.log('🆕 NOUVELLE session créée:', id);
    }
    
    console.log('🔑 Session ID:', id, 'pour utilisateur:', userId || 'anonyme');

    let sessionData = sessions.get(id);
    
    if (!sessionData || resetSession) {
      const newBuilder = new ESOBuilder();
      sessions.set(id, { 
        builder: newBuilder, 
        lastAccess: Date.now(),
        createdAt: new Date()
      });
      sessionData = sessions.get(id);
      console.log('📋 Nouveau builder ESO créé');
      
      if (resetSession) {
        console.log('🔄 Réinitialisation demandée');
      }
    } else {
      sessionData.lastAccess = Date.now();
    }
    
    const builder = sessionData.builder;
    const beforeSummary = builder.getSummary();
    console.log('📋 [AVANT] Résumé ESO:', JSON.stringify(beforeSummary));

    const useGroq = process.env.USE_GROQ === 'true' && processMessageGroq !== null;
    console.log('🔍 USE_GROQ =', useGroq);

    let result;
    if (useGroq) {
      result = await processMessageGroq(message, builder.getSummary(), id);
    } else {
      result = processMessage(message, builder.getSummary());
    }

    const { reply, extractedInfo, intent, confidence } = result;

    builder.update(extractedInfo);
    const summary = builder.getSummary();
    
    console.log('📋 [APRÈS] Résumé ESO:', JSON.stringify(summary));
    if (confidence) console.log(`📊 Score de confiance: ${Math.round(confidence * 100)}%`);

    // Sauvegarde en base MongoDB
    console.log('⏳ Tentative de sauvegarde MongoDB...');
    try {
      // Générer un titre à partir du premier message
      let title = 'Consultation médicale';
      if (summary.symptom) {
        title = `${summary.symptom} ${summary.bodyPart || ''}`.trim();
      } else if (message && message.length > 0) {
        title = message.substring(0, 50);
      }
      
      const updateData = {
        $push: {
          messages: {
            $each: [
              { sender: 'user', text: message, timestamp: new Date() },
              { sender: 'bot', text: reply, timestamp: new Date() }
            ]
          }
        },
        $set: {
          esoSummary: summary,
          intent: intent,
          updatedAt: new Date(),
          title: title
        }
      };
      
      if (userId) {
        updateData.$set.userId = userId;
      } else {
        updateData.$set.tempUserId = id;
      }
      
      if (isNewSession) {
        updateData.$set.createdAt = new Date();
      }

      const dbResult = await Conversation.findOneAndUpdate(
        { sessionId: id },
        updateData,
        { upsert: true, new: true }
      );
      console.log('✅ Sauvegarde réussie, ID doc:', dbResult._id);
    } catch (dbError) {
      console.error('❌ Erreur MongoDB:', dbError.message);
    }

    res.json({
      reply,
      esoSummary: summary,
      sessionId: id,
      intent,
      confidence: confidence || 0,
      isNewSession: isNewSession
    });

  } catch (error) {
    console.error('❌ Erreur générale dans handleChat:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

const resetChatSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (sessionId && sessions.has(sessionId)) {
      sessions.delete(sessionId);
      console.log(`🔄 Session ${sessionId} supprimée de la mémoire`);
    }
    
    res.json({ 
      success: true, 
      message: 'Session réinitialisée',
      newSessionId: Date.now().toString()
    });
  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
};

const cleanupSessions = async (req, res) => {
  const now = Date.now();
  let count = 0;
  for (const [id, data] of sessions.entries()) {
    if (data.lastAccess && (now - data.lastAccess) > 3600000) {
      sessions.delete(id);
      count++;
    }
  }
  console.log(`🧹 Nettoyage: ${count} sessions supprimées`);
  res.json({ success: true, sessionsDeleted: count, remainingSessions: sessions.size });
};

const getUserHistory = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const Conversation = require('../models/Conversation');
    
    const conversations = await Conversation.find({ userId })
      .sort({ updatedAt: -1 });
    
    console.log(`📊 ${conversations.length} conversations trouvées en base pour user ${userId}`);
    
    const formatted = conversations.map(conv => {
      const firstUserMsg = conv.messages?.find(m => m.sender === 'user');
      const lastBotMsg = conv.messages?.filter(m => m.sender === 'bot').pop();
      
      let title = conv.title;
      if (!title || title === 'Consultation médicale') {
        title = firstUserMsg?.text?.substring(0, 50) || 'Consultation médicale';
      }
      
      let preview = lastBotMsg?.text?.substring(0, 120) || 'En attente de réponse...';
      
      const hasUrgency = lastBotMsg?.text?.includes('URGENCE') || 
                         lastBotMsg?.text?.includes('critique') ||
                         lastBotMsg?.text?.includes('SAMU');
      
      return {
        id: conv._id,
        sessionId: conv.sessionId,
        date: conv.updatedAt ? new Date(conv.updatedAt).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR'),
        title: title,
        preview: preview,
        messageCount: conv.messages?.length || 0,
        urgency: hasUrgency
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

// Route pour l'historique public (sans authentification)
const getPublicHistory = async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.json([]);
    }
    
    const conversations = await Conversation.find({ 
      $or: [
        { sessionId: sessionId },
        { tempUserId: sessionId }
      ]
    }).sort({ updatedAt: -1 });
    
    const formatted = conversations.map(conv => {
      const firstUserMsg = conv.messages?.find(m => m.sender === 'user');
      const lastBotMsg = conv.messages?.filter(m => m.sender === 'bot').pop();
      
      let title = conv.title;
      if (!title || title === 'Consultation médicale') {
        title = firstUserMsg?.text?.substring(0, 50) || 'Consultation médicale';
      }
      
      let preview = lastBotMsg?.text?.substring(0, 120) || firstUserMsg?.text?.substring(0, 120) || 'Aucun message';
      
      const hasUrgency = lastBotMsg?.text?.includes('URGENCE') || false;
      
      return {
        id: conv._id,
        sessionId: conv.sessionId,
        date: conv.updatedAt ? new Date(conv.updatedAt).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR'),
        title: title,
        preview: preview,
        messageCount: conv.messages?.length || 0,
        urgency: hasUrgency
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('Erreur récupération historique public:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
};

module.exports = { 
  handleChat, 
  resetChatSession, 
  cleanupSessions,
  getUserHistory,
  getPublicHistory
};