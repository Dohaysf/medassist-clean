const axios = require('axios');
require('dotenv').config();

const D7_API_KEY = process.env.D7_API_KEY;
const EMERGENCY_PHONE = process.env.EMERGENCY_PHONE || "+212602641467";
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6');

/**
 * Envoie une alerte à un agent humain (SMS)
 * @param {Object} summary - Résumé ESO actuel
 * @param {string} sessionId - ID de la session
 * @param {string} reason - Raison de l'escalade
 * @param {number} confidence - Score de confiance (0-1)
 * @returns {Promise<boolean>}
 */
async function sendHumanAlert(summary, sessionId, reason, confidence = 0) {
    if (!D7_API_KEY) {
        console.error("❌ D7_API_KEY manquante - SMS non envoyé");
        return false;
    }

    const confidencePercent = Math.round(confidence * 100);
    const message = `🚨 ESCALADE HUMAINE - Chatbot MedAssist
━━━━━━━━━━━━━━━━━━━━━━
Session: ${sessionId || 'inconnue'}
Raison: ${reason}
Confiance: ${confidencePercent}%
━━━━━━━━━━━━━━━━━━━━━━
Symptôme: ${summary.symptom || 'Non renseigné'}
Zone: ${summary.bodyPart || 'Non renseigné'}
Âge: ${summary.age || 'Non renseigné'}
Lieu: ${summary.patientLocation || 'Non renseigné'}
Niveau: ${summary.severity || 'Inconnu'}
━━━━━━━━━━━━━━━━━━━━━━
⏰ ${new Date().toLocaleString()}`;

    try {
        await axios.post('https://api.d7networks.com/messages/v1/send', {
            messages: [{
                channel: "sms",
                recipients: [EMERGENCY_PHONE],
                content: message,
                msg_type: "text"
            }]
        }, {
            headers: {
                'Authorization': `Bearer ${D7_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ [HIL] Alerte humaine envoyée par SMS");
        return true;
    } catch (error) {
        let errorDetails;

        if (error && error.response && error.response.data) {
            errorDetails = error.response.data;
        } else {
            errorDetails = error.message;
        }

        console.error("❌ [HIL] Échec envoi SMS:", errorDetails);
        return false;
    }
}

/**
 * Vérifie si l'escalade humaine est nécessaire
 * @param {number} confidence - Score de confiance
 * @param {boolean} isCritical - Situation critique ?
 * @returns {boolean}
 */
function isHumanEscalationNeeded(confidence, isCritical = false) {
    if (isCritical && confidence < CONFIDENCE_THRESHOLD) {
        return true;
    } else {
        return false;
    }
}

module.exports = { sendHumanAlert, isHumanEscalationNeeded };