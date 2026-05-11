// backend/app/services/processMessageGroq.js
const { callGroq } = require('./groqService');
const { evaluateSeverity } = require('./nlpService');
const axios = require('axios');
require('dotenv').config();

// ================= CONFIGURATION =================
const D7_API_KEY = process.env.D7_API_KEY;
const EMERGENCY_PHONE = process.env.EMERGENCY_PHONE || "+212602641467";

const REQUIRED_FIELDS = ["symptom", "bodyPart", "duration", "age", "patientLocation"];

function getMissing(summary) {
    return REQUIRED_FIELDS.filter(f => !summary[f]);
}

function detectLanguage(message) {
    return /[\u0600-\u06FF]/.test(message) ? 'ar' : 'fr';
}

// ================= SMS, PFA, URGENCE (inchangés) =================
async function sendEmergencySMS(esoSummary, sessionId, reason) {
    if (!D7_API_KEY) {
        console.error("❌ D7_API_KEY manquante");
        return false;
    }
    const alertMessage = `🚨 URGENCE MEDICALE\nSession: ${sessionId}\nSymptôme: ${esoSummary.symptom || 'N/A'}\nLocalisation: ${esoSummary.bodyPart || 'N/A'}\nDurée: ${esoSummary.duration || 'N/A'}\nÂge: ${esoSummary.age || 'N/A'}\nLieu: ${esoSummary.patientLocation || 'N/A'}\nRaison: ${reason}`;
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

// ================= EXTRACTION GROQ (FR + AR avec exemples) =================
async function extractWithGroq(message, currentSummary) {
    const prompt = `
Tu es un assistant médical. Extrais les informations cliniques du message ci-dessous.
Message : "${message}"

Réponds STRICTEMENT en JSON avec ces champs :
{
  "symptom": "le symptôme principal (en français ou en arabe, selon la langue du message)",
  "bodyPart": "partie du corps ou null",
  "duration": "durée ou null",
  "age": "nombre (âge) ou null",
  "patientLocation": "lieu ou null",
  "intensity": "nombre 1-10 ou null"
}

Règnes :
- Ne déduis rien qui n'est pas explicitement dit.
- Pour l'arabe, interprète les expressions naturelles comme "اطفاري هشة" → symptom = "ضعف عظام" ou "fragilité osseuse" (peu importe la langue, l'important est de capturer le sens médical).
- Si le message dit "ما عنديش مشكل" → ne rien extraire.

Exemples pour t'entraîner (ils ne sont pas exhaustifs) :
- "j'ai de la fièvre" → {"symptom":"fièvre","bodyPart":null,"duration":null,"age":null,"patientLocation":null,"intensity":null}
- "عمري 30 سنة و عندي صداع شديد" → {"symptom":"صداع","bodyPart":null,"duration":null,"age":30,"patientLocation":null,"intensity":null}
- "اطفاري هشة" → {"symptom":"ضعف عظام","bodyPart":null,"duration":null,"age":null,"patientLocation":null,"intensity":null}
- "mon ami a perdu beaucoup de sang" → {"symptom":"hémorragie","bodyPart":null,"duration":null,"age":null,"patientLocation":null,"intensity":null}
- "douleur à la poitrine depuis 2 heures" → {"symptom":"douleur","bodyPart":"poitrine","duration":"2 heures","age":null,"patientLocation":null,"intensity":null}

Maintenant, extrais pour ce message : "${message}"
`;

    try {
        const response = await callGroq(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`✅ [GROQ] Extraction:`, parsed);
            return parsed;
        }
        console.warn("Aucun JSON trouvé, réponse brute:", response);
        return {};
    } catch (e) {
        console.error("❌ Erreur extraction Groq:", e.message);
        return {};
    }
}

// ================= QUESTION =================
async function askQuestion(field, lang = 'fr') {
    const questions = {
        fr: {
            symptom: "Quel est le problème principal ?",
            bodyPart: "Où exactement ? (partie du corps)",
            duration: "Depuis quand ?",
            age: "Quel âge a le patient ?",
            patientLocation: "Où se trouve le patient ?"
        },
        ar: {
            symptom: "ما هي المشكلة الرئيسية؟",
            bodyPart: "أين بالضبط؟ (جزء من الجسم)",
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
        'urgence', 'secours', 'samu', 'hémorragie', 'hemorragie', 'perte de sang',
        'دعاء', 'مساعدة', 'الإسعاف', 'نزيف',
        'douleur thoracique', 'étouffement', 'inconscience'
    ];
    const msg = message.toLowerCase();
    const sym = (summary.symptom || '').toLowerCase();
    return urgentKeywords.some(kw => msg.includes(kw) || sym.includes(kw));
}

// ================= PROCESS PRINCIPAL =================
async function processMessageGroq(userMessage, currentSummary = {}, sessionId = null) {
    console.log(`\n📨 [MESSAGE] "${userMessage}"`);
    console.log(`📊 [ÉTAT ACTUEL]`, JSON.stringify(currentSummary));

    // Réinitialiser si la session précédente était complète
    if (currentSummary && currentSummary._complete === true) {
        console.log(`🔄 [RESET] Session complète → nouvelle collecte`);
        currentSummary = {};
    }

    const lang = detectLanguage(userMessage);

    // Urgence
    if (checkEmergency(userMessage, currentSummary)) {
        console.log("🚨 [URGENCE] Détectée!");
        return await escaladeUrgence(currentSummary, sessionId, "Mot-clé d'urgence", 1.0);
    }

    // Extraction
    const extracted = await extractWithGroq(userMessage, currentSummary);

    // Mise à jour (ignorer null)
    const updatedSummary = {
        ...currentSummary,
        ...Object.fromEntries(
            Object.entries(extracted).filter(([_, v]) => v !== null && v !== "" && v !== undefined)
        )
    };
    delete updatedSummary._complete;

    console.log(`📊 [RÉSUMÉ MIS À JOUR]`, JSON.stringify(updatedSummary));

    // Sévérité
    let severity = evaluateSeverity(updatedSummary);
    if (updatedSummary.symptom && (updatedSummary.symptom.includes('hémorragie') || updatedSummary.symptom.includes('نزيف'))) {
        severity = 'critique';
    }
    console.log(`⚠️ [SÉVÉRITÉ] ${severity}`);

    // Priorité à l'âge
    if (!updatedSummary.age) {
        return {
            reply: await askQuestion('age', lang),
            extractedInfo: extracted,
            intent: "ask_age",
            severity,
            updatedSummary
        };
    }

    const missing = getMissing(updatedSummary);
    if (missing.length === 0) {
        await sendToPFA(updatedSummary, sessionId);
        const reply = lang === 'ar' ?
            `✅ **تم جمع جميع المعلومات**\n\n📋 الأعراض: ${updatedSummary.symptom}\n📍 الموقع: ${updatedSummary.bodyPart || 'غير محدد'}\n⏱️ المدة: ${updatedSummary.duration}\n👤 العمر: ${updatedSummary.age} سنة\n📍 الموقع الحالي: ${updatedSummary.patientLocation}\n\n🚨 مستوى الطوارئ: ${severity}` :
            `✅ **Informations complètes**\n\n📋 Symptôme: ${updatedSummary.symptom}\n📍 Localisation: ${updatedSummary.bodyPart || 'Non spécifiée'}\n⏱️ Durée: ${updatedSummary.duration}\n👤 Âge: ${updatedSummary.age} ans\n📍 Position: ${updatedSummary.patientLocation}\n\n🚨 Niveau d'urgence: ${severity}`;
        return {
            reply,
            extractedInfo: extracted,
            intent: "complete",
            severity,
            esoSummary: updatedSummary,
            updatedSummary: {...updatedSummary, _complete: true }
        };
    }

    const nextField = missing[0];
    return {
        reply: await askQuestion(nextField, lang),
        extractedInfo: extracted,
        intent: "collect",
        severity,
        updatedSummary
    };
}

module.exports = { processMessageGroq, escaladeUrgence };