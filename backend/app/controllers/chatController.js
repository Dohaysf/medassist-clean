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
        const userId = req.user ? req.user.userId : null;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ error: 'Message invalide' });
        }

        let id = sessionId;
        let isNewSession = false;

        // ✅ Gestion de la réinitialisation - FORCER nouvelle session
        if (resetSession === true) {
            // Supprimer l'ancienne session si elle existe
            if (id && sessions.has(id)) {
                sessions.delete(id);
                console.log(`🗑️ Ancienne session ${id} supprimée (reset demandé)`);
            }
            id = Date.now().toString();
            isNewSession = true;
            console.log('🆕 NOUVELLE SESSION (reset demandé):', id);
        } else if (!id) {
            id = Date.now().toString();
            isNewSession = true;
            console.log('🆕 NOUVELLE SESSION créée:', id);
        }

        console.log('🔑 Session ID:', id, 'pour utilisateur:', userId || 'anonyme');

        let sessionData = sessions.get(id);

        // ✅ Créer un nouveau builder pour les nouvelles sessions
        if (isNewSession || !sessionData) {
            const newBuilder = new ESOBuilder();
            sessions.set(id, {
                builder: newBuilder,
                lastAccess: Date.now(),
                createdAt: new Date()
            });
            sessionData = sessions.get(id);
            console.log('📋 Nouveau builder ESO créé (session propre)');
        } else {
            sessionData.lastAccess = Date.now();
            console.log('📋 Builder ESO existant réutilisé');
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

        const { reply, extractedInfo, intent, confidence, esoSummary } = result;

        // Mettre à jour le builder avec les nouvelles infos
        if (extractedInfo && Object.keys(extractedInfo).length > 0) {
            builder.update(extractedInfo);
        }

        const summary = builder.getSummary();
        console.log('📋 [APRÈS] Résumé ESO:', JSON.stringify(summary));

        // Sauvegarde en base MongoDB
        try {
            let title = 'Consultation médicale';
            if (summary.symptom) {
                title = `${summary.symptom} ${summary.bodyPart || ''}`.trim();
                if (title.length > 50) title = title.substring(0, 50);
            } else if (message && message.length > 0) {
                title = message.substring(0, 50);
            }

            let existingConversation = await Conversation.findOne({ sessionId: id });

            let updateData = {
                $set: {
                    esoSummary: summary,
                    intent: intent,
                    updatedAt: new Date(),
                    title: title
                },
                $push: {
                    messages: {
                        $each: [
                            { sender: 'user', text: message, timestamp: new Date() },
                            { sender: 'bot', text: reply, timestamp: new Date() }
                        ]
                    }
                }
            };

            if (userId) {
                updateData.$set.userId = userId;
            } else {
                updateData.$set.tempUserId = id;
            }

            if (isNewSession || !existingConversation) {
                updateData.$set.createdAt = new Date();
            }

            await Conversation.findOneAndUpdate({ sessionId: id }, updateData, { upsert: true, new: true });
            console.log('✅ Sauvegarde MongoDB réussie');
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

        // ✅ Supprimer complètement la session de la mémoire
        if (sessionId && sessions.has(sessionId)) {
            sessions.delete(sessionId);
            console.log(`🗑️ Session ${sessionId} supprimée de la mémoire`);
        }

        // ✅ Marquer la conversation comme réinitialisée en base
        if (sessionId) {
            try {
                await Conversation.findOneAndUpdate(
                    { sessionId: sessionId },
                    { $set: { resetAt: new Date(), isActive: false, esoSummary: {} } }
                );
            } catch (dbError) {
                console.log('Note: Base non mise à jour pour reset');
            }
        }

        const newSessionId = Date.now().toString();
        console.log(`✨ Nouvelle session créée: ${newSessionId}`);

        res.json({
            success: true,
            message: 'Session réinitialisée',
            newSessionId: newSessionId
        });
    } catch (error) {
        console.error('❌ Erreur réinitialisation:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
};

const cleanupSessions = async (req, res) => {
    try {
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
    } catch (error) {
        console.error('❌ Erreur nettoyage:', error);
        res.status(500).json({ error: 'Erreur lors du nettoyage' });
    }
};

const getUserHistory = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const Conversation = require('../models/Conversation');

        const conversations = await Conversation.find({ userId }).sort({ updatedAt: -1 });
        console.log(`📊 ${conversations.length} conversations trouvées pour user ${userId}`);

        const formatted = conversations.map(conv => {
            const firstUserMsg = conv.messages?.find(m => m.sender === 'user');
            const lastBotMsg = conv.messages?.filter(m => m.sender === 'bot').pop();

            let title = conv.title;
            if (!title || title === 'Consultation médicale') {
                title = firstUserMsg?.text?.substring(0, 50) || 'Consultation médicale';
            }

            let preview = lastBotMsg?.text?.substring(0, 120) || 'En attente de réponse...';
            let hasUrgency = lastBotMsg?.text?.includes('URGENCE') || false;

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

const getPublicHistory = async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) return res.json([]);

        const conversations = await Conversation.find({
            $or: [{ sessionId: sessionId }, { tempUserId: sessionId }]
        }).sort({ updatedAt: -1 });

        const formatted = conversations.map(conv => {
            const firstUserMsg = conv.messages?.find(m => m.sender === 'user');
            const lastBotMsg = conv.messages?.filter(m => m.sender === 'bot').pop();

            let title = conv.title || firstUserMsg?.text?.substring(0, 50) || 'Consultation médicale';
            let preview = lastBotMsg?.text?.substring(0, 120) || firstUserMsg?.text?.substring(0, 120) || 'Aucun message';

            return {
                id: conv._id,
                sessionId: conv.sessionId,
                date: conv.updatedAt ? new Date(conv.updatedAt).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR'),
                title: title,
                preview: preview,
                messageCount: conv.messages?.length || 0,
                urgency: false
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Erreur récupération historique public:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
};

const getSessionState = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionData = sessions.get(sessionId);
        if (!sessionData) return res.json({ exists: false });
        res.json({
            exists: true,
            summary: sessionData.builder.getSummary(),
            lastAccess: new Date(sessionData.lastAccess).toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur' });
    }
};

module.exports = {
    handleChat,
    resetChatSession,
    cleanupSessions,
    getUserHistory,
    getPublicHistory,
    getSessionState
};