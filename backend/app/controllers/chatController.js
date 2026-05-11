// backend/app/controllers/chatController.js
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

const handleChat = async(req, res) => {
    try {
        const { message, sessionId, resetSession } = req.body;
        const userId = req.user ? req.user.userId : null;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ error: 'Message invalide' });
        }

        let id = sessionId;
        let isNewSession = false;

        // Gestion de la réinitialisation
        if (resetSession) {
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

        // Si resetSession est true, on force la création d'un nouveau builder
        if (resetSession || !sessionData) {
            const newBuilder = new ESOBuilder();
            sessions.set(id, {
                builder: newBuilder,
                lastAccess: Date.now(),
                createdAt: new Date()
            });
            sessionData = sessions.get(id);
            console.log('📋 Nouveau builder ESO créé pour session:', id);
        } else {
            sessionData.lastAccess = Date.now();
            console.log('📋 Builder ESO existant réutilisé pour session:', id);
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
        if (confidence) console.log(`📊 Score de confiance: ${Math.round(confidence * 100)}%`);

        // Sauvegarde en base MongoDB
        console.log('⏳ Tentative de sauvegarde MongoDB...');
        try {
            // Générer un titre à partir du premier message
            let title = 'Consultation médicale';
            if (summary.symptom) {
                title = `${summary.symptom} ${summary.bodyPart || ''}`.trim();
                if (title.length > 50) title = title.substring(0, 50);
            } else if (message && message.length > 0) {
                title = message.substring(0, 50);
            }

            // Vérifier si la conversation existe déjà
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

            const dbResult = await Conversation.findOneAndUpdate({ sessionId: id },
                updateData, { upsert: true, new: true }
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

const resetChatSession = async(req, res) => {
    try {
        const { sessionId } = req.body;

        // Supprimer la session de la mémoire
        if (sessionId && sessions.has(sessionId)) {
            sessions.delete(sessionId);
            console.log(`🔄 Session ${sessionId} supprimée de la mémoire`);
        }

        // Optionnel: marquer la conversation comme réinitialisée en base
        if (sessionId) {
            try {
                await Conversation.findOneAndUpdate({ sessionId: sessionId }, { $set: { resetAt: new Date(), isActive: false } });
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

const cleanupSessions = async(req, res) => {
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

const getUserHistory = async(req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const Conversation = require('../models/Conversation');

        const conversations = await Conversation.find({ userId })
            .sort({ updatedAt: -1 });

        console.log(`📊 ${conversations.length} conversations trouvées en base pour user ${userId}`);

        const formatted = conversations.map(conv => {
            let firstUserMsg = null;
            if (conv.messages) {
                firstUserMsg = conv.messages.find(m => m.sender === 'user');
            }

            let lastBotMsg = null;
            if (conv.messages) {
                const botMessages = conv.messages.filter(m => m.sender === 'bot');
                if (botMessages.length > 0) {
                    lastBotMsg = botMessages[botMessages.length - 1];
                }
            }

            let title = conv.title;
            if (!title || title === 'Consultation médicale') {
                if (firstUserMsg && firstUserMsg.text) {
                    title = firstUserMsg.text.substring(0, 50);
                } else {
                    title = 'Consultation médicale';
                }
            }

            let preview = 'En attente de réponse...';
            if (lastBotMsg && lastBotMsg.text) {
                preview = lastBotMsg.text.substring(0, 120);
            }

            let hasUrgency = false;
            if (lastBotMsg && lastBotMsg.text) {
                hasUrgency = lastBotMsg.text.includes('URGENCE') ||
                    lastBotMsg.text.includes('critique') ||
                    lastBotMsg.text.includes('SAMU');
            }

            let dateStr = new Date().toLocaleString('fr-FR');
            if (conv.updatedAt) {
                dateStr = new Date(conv.updatedAt).toLocaleString('fr-FR');
            }

            return {
                id: conv._id,
                sessionId: conv.sessionId,
                date: dateStr,
                title: title,
                preview: preview,
                messageCount: conv.messages ? conv.messages.length : 0,
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
const getPublicHistory = async(req, res) => {
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
            let firstUserMsg = null;
            if (conv.messages) {
                firstUserMsg = conv.messages.find(m => m.sender === 'user');
            }

            let lastBotMsg = null;
            if (conv.messages) {
                const botMessages = conv.messages.filter(m => m.sender === 'bot');
                if (botMessages.length > 0) {
                    lastBotMsg = botMessages[botMessages.length - 1];
                }
            }

            let title = conv.title;
            if (!title || title === 'Consultation médicale') {
                if (firstUserMsg && firstUserMsg.text) {
                    title = firstUserMsg.text.substring(0, 50);
                } else {
                    title = 'Consultation médicale';
                }
            }

            let preview = 'Aucun message';
            if (lastBotMsg && lastBotMsg.text) {
                preview = lastBotMsg.text.substring(0, 120);
            } else if (firstUserMsg && firstUserMsg.text) {
                preview = firstUserMsg.text.substring(0, 120);
            }

            let hasUrgency = false;
            if (lastBotMsg && lastBotMsg.text) {
                hasUrgency = lastBotMsg.text.includes('URGENCE');
            }

            let dateStr = new Date().toLocaleString('fr-FR');
            if (conv.updatedAt) {
                dateStr = new Date(conv.updatedAt).toLocaleString('fr-FR');
            }

            return {
                id: conv._id,
                sessionId: conv.sessionId,
                date: dateStr,
                title: title,
                preview: preview,
                messageCount: conv.messages ? conv.messages.length : 0,
                urgency: hasUrgency
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Erreur récupération historique public:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
};

// Fonction pour obtenir l'état d'une session (debug)
const getSessionState = async(req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionData = sessions.get(sessionId);

        if (!sessionData) {
            return res.json({ exists: false, message: 'Session non trouvée' });
        }

        res.json({
            exists: true,
            summary: sessionData.builder.getSummary(),
            lastAccess: new Date(sessionData.lastAccess).toISOString(),
            createdAt: new Date(sessionData.createdAt).toISOString()
        });
    } catch (error) {
        console.error('Erreur:', error);
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