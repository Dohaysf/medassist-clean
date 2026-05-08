// backend/app/services/processMessageGroq.js
const { callGroq } = require('./groqService');
const { evaluateSeverity } = require('./nlpService');
const { getRAGResponse } = require('./ragService');
const axios = require('axios');
require('dotenv').config();

// ================= CONFIGURATION =================
const D7_API_KEY = process.env.D7_API_KEY;
const EMERGENCY_PHONE = process.env.EMERGENCY_PHONE || "+212602641467";

// ================= CHAMPS REQUIS POUR ESO =================
const REQUIRED_FIELDS = [
    "symptom",
    "bodyPart",
    "duration",
    "age",
    "patientLocation"
];

// ================= FONCTIONS UTILITAIRES =================
function getMissing(summary) {
    return REQUIRED_FIELDS.filter(f => !summary[f]);
}

function detectLanguage(message) {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(message) ? 'ar' : 'fr';
}

// ================= ENVOI SMS URGENCE =================
async function sendEmergencySMS(esoSummary, sessionId, reason) {
    if (!D7_API_KEY) {
        console.error("❌ D7_API_KEY manquante");
        return false;
    }

    const alertMessage = `🚨 URGENCE MEDICALE
Session: ${sessionId}
Symptôme: ${esoSummary.symptom || 'N/A'}
Localisation: ${esoSummary.bodyPart || 'N/A'}
Durée: ${esoSummary.duration || 'N/A'}
Âge: ${esoSummary.age || 'N/A'}
Lieu: ${esoSummary.patientLocation || 'N/A'}
Raison: ${reason}`;

    try {
        await axios.post('https://api.d7networks.com/messages/v1/send', {
            messages: [{
                channel: "sms",
                recipients: [EMERGENCY_PHONE],
                content: alertMessage,
                msg_type: "text"
            }]
        }, {
            headers: {
                'Authorization': `Bearer ${D7_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log("✅ SMS urgence envoyé");
        return true;
    } catch (error) {
        if (error.response) {
            console.error("❌ SMS échoué:", error.response.data);
        } else {
            console.error("❌ SMS échoué:", error.message);
        }
        return false;
    }
}

// ================= ENVOI VERS PFA =================
async function sendToPFA(summary, sessionId) {
    try {
        await axios.post('http://localhost:3000/api/chatbot/emergency', {
            esoSummary: summary,
            sessionId
        });
        console.log(`✅ PFA envoyé pour session ${sessionId}`);
    } catch (e) {
        console.error("❌ PFA error:", e.message);
    }
}

// ================= ESCALADE URGENCE =================
async function escaladeUrgence(summary, sessionId, reason, confidence = null) {
    console.warn(`🚨 [ESCALADE] ${reason}`);
    await sendEmergencySMS(summary, sessionId, reason);

    const lang = detectLanguage(JSON.stringify(summary));
    const reply = lang === 'ar' ?
        `⚠️ **حالة طارئة طبية**\n\nاتصل فوراً بالإسعاف على الرقم **141**\n\nتم إرسال تنبيه للفريق الطبي.` :
        `⚠️ **ALERTE MÉDICALE**\n\nSituation nécessitant une attention immédiate.\n\nAppellez le **SAMU** au **141**.\n\nUn message d'alerte a été envoyé à l'équipe médicale.`;

    return {
        reply: reply,
        intent: "escalade_urgence",
        extractedInfo: summary,
        confidence: confidence || 0
    };
}

// ================= EXTRACTION GROQ =================
async function extractWithGroq(message, currentSummary) {
    const prompt = `
Tu es un assistant médical.

Analyse le message et extrais les informations utiles.

Message:
"${message}"

Données actuelles:
${JSON.stringify(currentSummary)}

Réponds STRICTEMENT en JSON:

{
  "symptom": "...",
  "bodyPart": "...",
  "duration": "...",
  "intensity": nombre,
  "age": nombre,
  "patientLocation": "..."
}

Règles:
- Compréhension intelligente (ex: "ça s'aggrave" → intensité élevée)
- Champs inconnus → null
- Pas de texte hors JSON
- Pour l'âge, extrais uniquement le nombre
- Pour l'intensité, extrais un nombre entre 1 et 10
`;

    try {
        const response = await callGroq(prompt);
        console.log(`📝 [GROQ] Réponse:`, response.substring(0, 200));

        // Extraire le JSON de la réponse
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`✅ [GROQ] Extraction:`, parsed);
            return parsed;
        }
        return {};
    } catch (e) {
        console.error("❌ erreur Groq:", e.message);
        return {};
    }
}

// ================= QUESTION =================
async function askQuestion(field, lang = 'fr') {
    const questions = {
        fr: {
            symptom: "Quel est le problème principal ?",
            bodyPart: "Où avez-vous mal ?",
            duration: "Depuis quand ?",
            age: "Quel âge a le patient ?",
            patientLocation: "Où se trouve le patient ?"
        },
        ar: {
            symptom: "ما هي المشكلة الرئيسية؟",
            bodyPart: "أين تشعر بالألم؟",
            duration: "منذ متى؟",
            age: "كم عمر المريض؟",
            patientLocation: "أين يوجد المريض؟"
        }
    };

    return questions[lang][field] || questions.fr[field];
}

// ================= VÉRIFICATION URGENCE =================
function checkEmergency(message, summary) {
    const urgentKeywords = [
        'urgence', 'secours', 'aide', 'au secours', 'samu',
        'دعاء', 'مساعدة', 'الإسعاف', 'طوارئ',
        'douleur thoracique', 'douleur poitrine', 'étouffement',
        'inconscience', 'perte connaissance', 'convulsion',
        'ألم في الصدر', 'ضيق التنفس', 'فقدان الوعي'
    ];

    const messageLower = message.toLowerCase();
    const symptomLower = (summary.symptom || '').toLowerCase();

    for (const keyword of urgentKeywords) {
        if (messageLower.includes(keyword) || symptomLower.includes(keyword)) {
            return true;
        }
    }
    return false;
}

// ================= PROCESS PRINCIPAL =================
async function processMessageGroq(userMessage, currentSummary = {}, sessionId = null) {

    console.log(`\n📨 [MESSAGE] "${userMessage}"`);
    console.log(`📊 [ÉTAT ACTUEL]`, JSON.stringify(currentSummary));

    // Détecter la langue
    const lang = detectLanguage(userMessage);
    console.log(`🌐 [LANGUE] ${lang}`);

    // 1. Vérifier urgence
    if (checkEmergency(userMessage, currentSummary)) {
        console.log("🚨 [URGENCE] Détectée!");
        return await escaladeUrgence(currentSummary, sessionId, "Mot-clé d'urgence détecté", 1.0);
    }

    // 2. Extraction IA
    const extracted = await extractWithGroq(userMessage, currentSummary);

    // 3. Mettre à jour le résumé
    const updatedSummary = {
        ...currentSummary,
        ...Object.fromEntries(
            Object.entries(extracted).filter(([_, v]) => v !== null && v !== "")
        )
    };

    console.log(`📊 [RÉSUMÉ MIS À JOUR]`, JSON.stringify(updatedSummary));

    // 4. Évaluer la sévérité
    const severity = evaluateSeverity(updatedSummary);
    console.log(`⚠️ [SÉVÉRITÉ] ${severity}`);

    // 5. AGE obligatoire en premier
    if (!updatedSummary.age) {
        console.log(`❓ [QUESTION] Âge manquant`);
        return {
            reply: await askQuestion('age', lang),
            extractedInfo: extracted,
            intent: "ask_age",
            severity: severity
        };
    }

    // 6. Vérifier les champs ESO manquants
    const missing = getMissing(updatedSummary);
    console.log(`❓ [CHAMPS MANQUANTS] ${missing.join(', ') || 'Aucun'}`);

    // 7. Si tout est complet → FIN
    if (missing.length === 0) {
        console.log(`✅ [COMPLET] Envoi à PFA...`);

        if (sessionId) {
            await sendToPFA(updatedSummary, sessionId);
        }

        // Générer un résumé pour l'utilisateur
        let summaryReply = '';
        if (lang === 'ar') {
            summaryReply = `✅ **تم جمع جميع المعلومات**\n\n📋 الأعراض: ${updatedSummary.symptom}\n📍 الموقع: ${updatedSummary.bodyPart}\n⏱️ المدة: ${updatedSummary.duration}\n👤 العمر: ${updatedSummary.age} سنة\n📍 الموقع الحالي: ${updatedSummary.patientLocation}\n\n🚨 مستوى الطوارئ: ${severity}`;
        } else {
            summaryReply = `✅ **Informations complètes**\n\n📋 Symptôme: ${updatedSummary.symptom}\n📍 Localisation: ${updatedSummary.bodyPart}\n⏱️ Durée: ${updatedSummary.duration}\n👤 Âge: ${updatedSummary.age} ans\n📍 Position: ${updatedSummary.patientLocation}\n\n🚨 Niveau d'urgence: ${severity}`;
        }

        return {
            reply: summaryReply,
            extractedInfo: extracted,
            intent: "complete",
            severity: severity,
            esoSummary: updatedSummary
        };
    }

    // 8. Poser la prochaine question
    const nextField = missing[0];
    console.log(`❓ [PROCHAINE QUESTION] ${nextField}`);

    return {
        reply: await askQuestion(nextField, lang),
        extractedInfo: extracted,
        intent: "collect",
        severity: severity
    };
}

module.exports = {
    processMessageGroq,
    escaladeUrgence
};