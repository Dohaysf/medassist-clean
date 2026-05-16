// backend/app/routes/chat.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const { handleChat, resetChatSession, cleanupSessions, getUserHistory } = require('../controllers/chatController');
const { escaladeUrgence } = require('../services/processMessageGroq');
const auth = require('../middleware/auth');

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: 'uploads/audio/',
    filename: function(req, file, cb) {
        const ext = file.originalname.split('.').pop() || 'wav';
        cb(null, Date.now() + '.' + ext);
    }
});
const upload = multer({ storage: storage });

// ── Config Whisper local ──────────────────────────────────────────────────────
const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://localhost:8001';

// ─────────────────────────────────────────────────────────────────────────────
// Fonction : proxy vers le microservice Python Whisper
// ─────────────────────────────────────────────────────────────────────────────
async function transcribeWithWhisperLocal(filePath, language) {
    const fileBuffer = fs.readFileSync(filePath);
    const ext = filePath.split('.').pop() || 'webm';

    const mimeTypes = {
        webm: 'audio/webm',
        wav: 'audio/wav',
        mp4: 'audio/mp4',
        m4a: 'audio/mp4',
        ogg: 'audio/ogg',
        mp3: 'audio/mpeg',
    };
    const mimeType = mimeTypes[ext] || 'audio/webm';

    const formData = new FormData();
    const filename = ext === 'wav' ? 'audio.wav' : `audio.${ext}`;
    formData.append('file', fileBuffer, {
        filename: filename,
        contentType: mimeType,
    });
    formData.append('language', language);

    console.log(`📤 → Whisper local: ${fileBuffer.length} bytes [${mimeType}]`);

    try {
        const response = await axios.post(
            `${WHISPER_SERVICE_URL}/transcribe`,
            formData, {
                headers: {...formData.getHeaders() },
                timeout: 60000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );
        return response.data.transcript || '';
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            throw new Error(
                `Service Whisper non démarré sur ${WHISPER_SERVICE_URL}.\n` +
                `Lance : cd whisper_service && python main.py`
            );
        }
        const detail = (err.response && err.response.data && err.response.data.detail) ? err.response.data.detail : err.message;
        throw new Error(`Whisper local: ${detail}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : POST /api/chat/transcribe
// ─────────────────────────────────────────────────────────────────────────────
router.post('/transcribe', upload.single('audio'), async(req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier audio reçu' });
    }

    const filePath = req.file.path;
    const language = req.body.language || 'fr';

    try {
        const transcript = await transcribeWithWhisperLocal(filePath, language);
        console.log(`✅ Transcription OK: "${transcript.substring(0, 80)}"`);
        res.json({ transcript, service: 'local' });
    } catch (err) {
        console.error('❌ Transcription échouée:', err.message);
        res.status(500).json({
            error: 'Erreur de transcription audio',
            details: err.message,
        });
    } finally {
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : GET /api/chat/whisper-health
// ─────────────────────────────────────────────────────────────────────────────
router.get('/whisper-health', async(req, res) => {
    try {
        const r = await axios.get(`${WHISPER_SERVICE_URL}/health`, { timeout: 5000 });
        res.json({ status: 'healthy', ...r.data });
    } catch {
        res.status(503).json({
            status: 'unhealthy',
            hint: `Lance: cd whisper_service && python main.py`,
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ✅ ROUTE : POST /api/chat/ (AVEC auth !)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', auth, handleChat);  // ← ICI LA CORRECTION !

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : POST /api/chat/reset-session
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-session', resetChatSession);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : POST /api/chat/emergency-manual
// ─────────────────────────────────────────────────────────────────────────────
router.post('/emergency-manual', async(req, res) => {
    try {
        const { sessionId, summary } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });

        const result = await escaladeUrgence(
            summary || {}, sessionId, "Déclenchement manuel par bouton"
        );
        res.json({ success: true, reply: result.reply });
    } catch (error) {
        console.error('Erreur urgence manuelle:', error);
        res.status(500).json({ error: "Erreur lors de l'alerte" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : GET /api/chat/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', auth, getUserHistory);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : DELETE /api/chat/history/all
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/history/all', auth, async(req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const Conversation = require('../models/Conversation');
        const result = await Conversation.deleteMany({ userId });
        console.log(`🗑️ ${result.deletedCount} conversations supprimées — user ${userId}`);
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Erreur suppression totale:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : DELETE /api/chat/history/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/history/:id', auth, async(req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const { id } = req.params;
        const Conversation = require('../models/Conversation');
        const result = await Conversation.findOneAndDelete({ _id: id, userId });
        if (!result) return res.status(404).json({ error: 'Conversation non trouvée' });
        console.log(`🗑️ Conversation ${id} supprimée — user ${userId}`);
        res.json({ success: true, message: 'Conversation supprimée' });
    } catch (error) {
        console.error('Erreur suppression:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : POST /api/chat/save-session
// ─────────────────────────────────────────────────────────────────────────────
router.post('/save-session', auth, async(req, res) => {
    try {
        const { sessionId, messages } = req.body;
        const userId = req.user.userId || req.user.id;

        if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });
        if (!messages || !messages.length) return res.status(400).json({ error: 'Aucun message à sauvegarder' });

        const Conversation = require('../models/Conversation');

        const formattedMessages = messages.map(msg => ({
            sender: msg.role === 'user' || msg.sender === 'user' ? 'user' : 'bot',
            text: msg.content || msg.text,
            timestamp: new Date(),
        }));

        const conversation = await Conversation.findOneAndUpdate({ userId, sessionId }, {
            $set: {
                messages: formattedMessages,
                title: (formattedMessages[0] && formattedMessages[0].text) ? formattedMessages[0].text.substring(0, 50) : 'Consultation médicale',
                updatedAt: new Date(),
            },
            $setOnInsert: { userId, sessionId, createdAt: new Date(), esoSummary: {} },
        }, { upsert: true, new: true });

        console.log(`✅ Session sauvegardée — user: ${userId}, session: ${sessionId}`);
        res.json({ success: true, conversationId: conversation._id });
    } catch (error) {
        console.error('Erreur sauvegarde session:', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : POST /api/chat/cleanup-sessions  (manager)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cleanup-sessions', auth, async(req, res) => {
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