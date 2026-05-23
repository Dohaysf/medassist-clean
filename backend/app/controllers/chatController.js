// backend/app/controllers/chatController.js
const { processMessage } = require('../services/nlpService');
const ESOBuilder = require('../utils/esoBuilder');
const Conversation = require('../models/Conversation');
const { processMessageGroq } = require('../services/processMessageGroq');
const User = require('../models/User'); // ✅ AJOUT : Importer le modèle User

console.log('✅ processMessageGroq importée');

// Map des sessions actives en mémoire
const sessions = new Map();

// Nettoyage automatique des sessions inactives
setInterval(() => {
    const now = Date.now();

    for (const [id, data] of sessions.entries()) {
        if (data.lastAccess && (now - data.lastAccess) > 3600000) {
            sessions.delete(id);
            console.log(`🧹 Session ${id} supprimée (inactive depuis >1h)`);
        }
    }
}, 600000);

// ================= HELPER : HISTORIQUE =================
function getFormattedHistory(sessionData, limit = 10) {

    if (!sessionData ||
        !sessionData.conversationHistory ||
        !Array.isArray(sessionData.conversationHistory)
    ) {
        return [];
    }

    return sessionData.conversationHistory.slice(-limit);
}

// ================= HANDLE CHAT =================
const handleChat = async(req, res) => {

    try {

        const { message, sessionId, resetSession } = req.body;

        // ✅ Récupérer l'userId du token et les antécédents
        let userId = null;
        let userMedicalHistory = null;
        let userAge = null;
        let userGender = null;

        if (req.user && req.user.userId) {
            userId = req.user.userId;
        } else if (req.user && req.user.id) {
            userId = req.user.id;
        }

        // ✅ Récupérer les antécédents médicaux de l'utilisateur
        if (userId) {
            try {
                const user = await User.findById(userId).select('medicalHistory age gender');
                if (user) {
                    userMedicalHistory = user.medicalHistory;
                    userAge = user.age;
                    userGender = user.gender;
                    console.log(`🏥 Antécédents du patient:`, userMedicalHistory);
                    console.log(`👤 Âge: ${userAge}, Sexe: ${userGender}`);
                }
            } catch (err) {
                console.error('❌ Erreur récupération antécédents:', err.message);
            }
        }

        console.log(`👤 Utilisateur connecté: ${userId || 'anonyme'}`);
        console.log(`📨 Message reçu: "${message?.substring(0, 50)}..."`);

        if (!message ||
            typeof message !== 'string' ||
            message.trim() === ''
        ) {
            return res.status(400).json({
                error: 'Message invalide'
            });
        }

        let id = sessionId;
        let isNewSession = false;

        // Reset session
        if (resetSession === true) {

            if (id && sessions.has(id)) {
                sessions.delete(id);
                console.log(`🗑️ Ancienne session ${id} supprimée`);
            }

            id = Date.now().toString();
            isNewSession = true;

            console.log('🆕 Nouvelle session reset:', id);

        } else if (!id) {

            id = Date.now().toString();
            isNewSession = true;

            console.log('🆕 Nouvelle session:', id);
        }

        console.log('🔑 Session ID:', id);

        let sessionData = sessions.get(id);

        // Initialiser session
        if (!sessionData || isNewSession) {

            sessions.set(id, {
                builder: new ESOBuilder(),
                lastAccess: Date.now(),
                createdAt: new Date(),
                conversationHistory: []
            });

            sessionData = sessions.get(id);

            console.log('📋 Session initialisée');

        } else {

            sessionData.lastAccess = Date.now();

            let historyLength = 0;

            if (
                sessionData.conversationHistory &&
                Array.isArray(sessionData.conversationHistory)
            ) {
                historyLength = sessionData.conversationHistory.length;
            }

            console.log(
                `📋 Session existante — ${historyLength} messages`
            );
        }

        const builder = sessionData.builder;

        console.log(
            '📋 [AVANT] ESO:',
            JSON.stringify(builder.getSummary())
        );

        const conversationHistory =
            getFormattedHistory(sessionData, 10);

        const useGroq =
            process.env.USE_GROQ === 'true' &&
            processMessageGroq !== null;

        console.log('🔍 USE_GROQ =', useGroq);

        let result;

        if (useGroq) {

            // ✅ MODIFICATION : Passer les antécédents à processMessageGroq
            result = await processMessageGroq(
                message,
                builder.getSummary(),
                id,
                conversationHistory,
                userMedicalHistory,  // ✅ AJOUT : Antécédents
                userAge,             // ✅ AJOUT : Âge
                userGender           // ✅ AJOUT : Sexe
            );

        } else {

            result = processMessage(
                message,
                builder.getSummary()
            );
        }

        const {
            reply,
            extractedInfo,
            intent,
            confidence,
            updatedSummary
        } = result;

        // Mise à jour ESO
        const infoToMerge =
            updatedSummary || extractedInfo;

        if (
            infoToMerge &&
            Object.keys(infoToMerge).length > 0
        ) {

            const cleanInfo = {};

            for (const key in infoToMerge) {

                const value = infoToMerge[key];

                if (
                    value !== null &&
                    value !== undefined &&
                    value !== '' &&
                    !String(value).startsWith('_')
                ) {
                    cleanInfo[key] = value;
                }
            }

            if (Object.keys(cleanInfo).length > 0) {
                builder.update(cleanInfo);
            }
        }

        const summary = builder.getSummary();

        console.log(
            '📋 [APRÈS] ESO:',
            JSON.stringify(summary)
        );

        // Historique mémoire
        sessionData.conversationHistory.push({
            role: 'user',
            content: message
        }, {
            role: 'assistant',
            content: reply
        });

        // Limite historique
        if (sessionData.conversationHistory.length > 30) {
            sessionData.conversationHistory =
                sessionData.conversationHistory.slice(-30);
        }

        // ================= MONGODB (CORRIGÉ) =================
        try {

            let title = 'Consultation médicale';

            if (summary.symptom) {

                title =
                    `${summary.symptom} ${summary.bodyPart || ''}`.trim();

                if (title.length > 50) {
                    title = title.substring(0, 50);
                }

            } else if (message.length > 0) {

                title = message.substring(0, 50);
            }

            // ✅ Vérifier si la conversation existe déjà
            let existingConversation = await Conversation.findOne({ sessionId: id });
            
            // ✅ CRUCIAL : Si l'utilisateur est connecté, FORCER l'association
            if (userId) {
                // Si la conversation existe déjà sans userId, la mettre à jour
                if (existingConversation && !existingConversation.userId) {
                    console.log(`🔄 FORCAGE: Association de la conversation ${id} à l'utilisateur ${userId}`);
                    await Conversation.updateOne(
                        { sessionId: id },
                        { $set: { userId: userId, tempUserId: null } }
                    );
                    existingConversation = await Conversation.findOne({ sessionId: id });
                }
            }

            const updateData = {
                $set: {
                    esoSummary: summary,
                    intent: intent,
                    updatedAt: new Date(),
                    title: title
                },
                $push: {
                    messages: {
                        $each: [{
                                sender: 'user',
                                text: message,
                                timestamp: new Date()
                            },
                            {
                                sender: 'bot',
                                text: reply,
                                timestamp: new Date()
                            }
                        ]
                    }
                }
            };

            // ✅ FORCER userId si l'utilisateur est connecté
            if (userId) {
                updateData.$set.userId = userId;
                updateData.$unset = { tempUserId: "" };
                console.log(`✅ Sauvegarde AVEC userId: ${userId}`);
            } else {
                updateData.$set.tempUserId = id;
                console.log(`⚠️ Sauvegarde anonyme - tempUserId: ${id}`);
            }

            if (isNewSession && !existingConversation) {
                updateData.$set.createdAt = new Date();
            }

            const result = await Conversation.findOneAndUpdate(
                { sessionId: id },
                updateData,
                { upsert: true, new: true }
            );

            console.log(`✅ Sauvegarde MongoDB réussie - userId final: ${result.userId || 'anonyme'}`);
            console.log(`📊 ESO Summary sauvegardé:`, summary);

        } catch (dbError) {

            console.error(
                '❌ Erreur MongoDB:',
                dbError.message
            );
        }

        res.json({
            reply,
            esoSummary: summary,
            sessionId: id,
            intent,
            confidence: confidence || 0,
            isNewSession
        });

    } catch (error) {

        console.error(
            '❌ Erreur générale dans handleChat:',
            error
        );

        res.status(500).json({
            error: 'Erreur interne du serveur'
        });
    }
};

// ================= RESET SESSION =================
const resetChatSession = async(req, res) => {

    try {

        const { sessionId } = req.body;

        if (sessionId && sessions.has(sessionId)) {

            sessions.delete(sessionId);

            console.log(
                `🗑️ Session ${sessionId} supprimée`
            );
        }

        try {

            if (sessionId) {

                await Conversation.findOneAndUpdate({ sessionId }, {
                    $set: {
                        resetAt: new Date(),
                        isActive: false,
                        esoSummary: {}
                    }
                });
            }

        } catch (dbError) {

            console.log(
                'Note: Base non mise à jour pour reset'
            );
        }

        const newSessionId = Date.now().toString();

        res.json({
            success: true,
            message: 'Session réinitialisée',
            newSessionId
        });

    } catch (error) {

        console.error(
            '❌ Erreur reset:',
            error
        );

        res.status(500).json({
            error: 'Erreur reset'
        });
    }
};

// ================= CLEANUP =================
const cleanupSessions = async(req, res) => {

    try {

        const now = Date.now();

        let count = 0;

        for (const [id, data] of sessions.entries()) {

            if (
                data.lastAccess &&
                (now - data.lastAccess) > 3600000
            ) {
                sessions.delete(id);
                count++;
            }
        }

        res.json({
            success: true,
            sessionsDeleted: count,
            remainingSessions: sessions.size
        });

    } catch (error) {

        console.error(
            '❌ Erreur nettoyage:',
            error
        );

        res.status(500).json({
            error: 'Erreur nettoyage'
        });
    }
};

// ================= USER HISTORY =================
const getUserHistory = async(req, res) => {

    try {

        const userId =
            req.user.userId || req.user.id;

        console.log(`🔍 Récupération historique pour user: ${userId}`);

        const conversations =
            await Conversation.find({ userId })
            .sort({ updatedAt: -1 });

        console.log(
            `📊 ${conversations.length} conversations trouvées`
        );

        const formatted = conversations.map(conv => {

            let firstUserMsg = null;
            let lastBotMsg = null;

            if (
                conv.messages &&
                Array.isArray(conv.messages)
            ) {

                firstUserMsg =
                    conv.messages.find(
                        m => m.sender === 'user'
                    );

                const botMessages =
                    conv.messages.filter(
                        m => m.sender === 'bot'
                    );

                if (botMessages.length > 0) {
                    lastBotMsg =
                        botMessages[botMessages.length - 1];
                }
            }

            let title = 'Consultation médicale';

            if (
                conv.title &&
                conv.title !== 'Consultation médicale'
            ) {

                title = conv.title;

            } else if (
                firstUserMsg &&
                firstUserMsg.text
            ) {

                title =
                    firstUserMsg.text.substring(0, 50);
            }

            return {
                id: conv._id,

                sessionId: conv.sessionId,

                date: conv.updatedAt ?
                    new Date(conv.updatedAt)
                    .toLocaleString('fr-FR') : new Date()
                    .toLocaleString('fr-FR'),

                title: title,

                preview: lastBotMsg &&
                    lastBotMsg.text ?
                    lastBotMsg.text.substring(0, 120) : 'En attente de réponse...',

                messageCount: conv.messages &&
                    Array.isArray(conv.messages) ?
                    conv.messages.length : 0,

                urgency: lastBotMsg &&
                    lastBotMsg.text &&
                    lastBotMsg.text.includes('URGENCE')
            };
        });

        res.json(formatted);

    } catch (error) {

        console.error(
            'Erreur récupération historique:',
            error
        );

        res.status(500).json({
            error: 'Erreur récupération'
        });
    }
};

// ================= PUBLIC HISTORY =================
const getPublicHistory = async(req, res) => {

    try {

        const sessionId =
            req.headers['x-session-id'];

        if (!sessionId) {
            return res.json([]);
        }

        const conversations =
            await Conversation.find({
                $or: [
                    { sessionId },
                    { tempUserId: sessionId }
                ]
            }).sort({ updatedAt: -1 });

        const formatted = conversations.map(conv => {

            let firstUserMsg = null;
            let lastBotMsg = null;

            if (
                conv.messages &&
                Array.isArray(conv.messages)
            ) {

                firstUserMsg =
                    conv.messages.find(
                        m => m.sender === 'user'
                    );

                const botMessages =
                    conv.messages.filter(
                        m => m.sender === 'bot'
                    );

                if (botMessages.length > 0) {
                    lastBotMsg =
                        botMessages[botMessages.length - 1];
                }
            }

            let title = 'Consultation médicale';

            if (conv.title) {

                title = conv.title;

            } else if (
                firstUserMsg &&
                firstUserMsg.text
            ) {

                title =
                    firstUserMsg.text.substring(0, 50);
            }

            let preview = 'Aucun message';

            if (
                lastBotMsg &&
                lastBotMsg.text
            ) {

                preview =
                    lastBotMsg.text.substring(0, 120);

            } else if (
                firstUserMsg &&
                firstUserMsg.text
            ) {

                preview =
                    firstUserMsg.text.substring(0, 120);
            }

            return {
                id: conv._id,

                sessionId: conv.sessionId,

                date: conv.updatedAt ?
                    new Date(conv.updatedAt)
                    .toLocaleString('fr-FR') : new Date()
                    .toLocaleString('fr-FR'),

                title: title,

                preview: preview,

                messageCount: conv.messages &&
                    Array.isArray(conv.messages) ?
                    conv.messages.length : 0,

                urgency: false
            };
        });

        res.json(formatted);

    } catch (error) {

        console.error(
            'Erreur historique public:',
            error
        );

        res.status(500).json({
            error: 'Erreur récupération'
        });
    }
};

// ================= SESSION STATE =================
const getSessionState = async(req, res) => {

    try {

        const { sessionId } = req.params;

        const sessionData =
            sessions.get(sessionId);

        if (!sessionData) {

            return res.json({
                exists: false
            });
        }

        let historyLength = 0;

        if (
            sessionData.conversationHistory &&
            Array.isArray(sessionData.conversationHistory)
        ) {
            historyLength =
                sessionData.conversationHistory.length;
        }

        res.json({
            exists: true,
            summary: sessionData.builder.getSummary(),
            historyLength: historyLength,
            lastAccess: new Date(sessionData.lastAccess)
                .toISOString()
        });

    } catch (error) {

        res.status(500).json({
            error: 'Erreur'
        });
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