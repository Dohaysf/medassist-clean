// backend/app/services/processMessageGroq.js
const { callGroq } = require('./groqService');
const { evaluateSeverity } = require('./nlpService');
const { getRAGResponse } = require('./ragService');
const { calculateRAGConfidence, calculateGroqConfidence } = require('./confidenceService');
const axios = require('axios');
require('dotenv').config();

// ================= CONFIGURATION =================
const D7_API_KEY = process.env.D7_API_KEY;
const EMERGENCY_PHONE = process.env.EMERGENCY_PHONE || "+212602641467";
const MAX_GROQ_RETRIES = 2;
const RAG_CONFIDENCE_THRESHOLD = 0.3;

// ================= REQUIRED FIELDS =================
const REQUIRED_FIELDS = [
    "symptom",
    "bodyPart",
    "duration",
    "age",
    "patientLocation"
];

// Symptômes généraux qui n'ont pas de partie du corps spécifique
const GENERAL_SYMPTOMS = ['fievre', 'fièvre', 'fatigue', 'anxiété', 'stress', 'toux', 'nausée', 'vertige'];

function getMissing(summary) {
    let fields = [...REQUIRED_FIELDS];
    
    if (summary.symptom && GENERAL_SYMPTOMS.some(s => summary.symptom.includes(s))) {
        fields = fields.filter(f => f !== 'bodyPart');
    }
    
    return fields.filter(f => !summary[f]);
}

// ================= ENVOI PFA =================
async function sendToPFA(summary, sessionId) {
    const missing = getMissing(summary);
    if (missing.length > 0) {
        console.warn(`⚠️ Envoi PFA ignoré, champs manquants : ${missing.join(', ')}`);
        return;
    }
    try {
        await axios.post('http://localhost:3000/api/chatbot/emergency', {
            esoSummary: summary,
            sessionId
        });
        console.log(`✅ PFA : données envoyées pour session ${sessionId}`);
    } catch (e) {
        console.error(`❌ Erreur PFA : ${e.message}`);
    }
}

// ================= ENVOI SMS D7 =================
async function sendEmergencySMS(summary, sessionId, reason, confidence = null) {
    if (!D7_API_KEY) {
        console.error("❌ Impossible d'envoyer le SMS : D7_API_KEY manquante");
        return false;
    }

    const confidenceMsg = confidence ? `Confiance: ${Math.round(confidence * 100)}%` : '';
    const alertMessage = `🚨 URGENCE MEDICALE - Chatbot
Session: ${sessionId || 'inconnue'}
Symptôme: ${summary.symptom || 'Non renseigné'}
Zone: ${summary.bodyPart || 'Non renseigné'}
Âge: ${summary.age || 'Non renseigné'}
Lieu: ${summary.patientLocation || 'Non renseigné'}
Niveau: ${evaluateSeverity(summary)}
Raison: ${reason}
${confidenceMsg}`.trim();

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
        console.log("✅ SMS d'urgence envoyé avec succès via D7 Networks !");
        return true;
    } catch (error) {
        console.error("❌ Échec envoi SMS D7 :", error.response?.data || error.message);
        return false;
    }
}

// ================= ESCALADE URGENCE =================
async function escaladeUrgence(summary, sessionId, reason, confidence = null) {
    const confidenceMsg = confidence ? ` (confiance: ${Math.round(confidence * 100)}%)` : '';
    console.warn(`🚨 [ESCALADE URGENCE] Déclenchée - Raison: ${reason}${confidenceMsg}`);
    await sendEmergencySMS(summary, sessionId, reason, confidence);
    
    return {
        reply: `⚠️ **ALERTE MÉDICALE**\n\nNous rencontrons une situation qui nécessite une attention immédiate.\n\nPour votre sécurité, veuillez appeler immédiatement le **SAMU** au **141**.\n\nUn message d'alerte a été envoyé à notre équipe médicale.`,
        intent: "escalade_urgence",
        extractedInfo: {},
        confidence: confidence || 0
    };
}

// ================= EXTRACTION GROQ AMÉLIORÉE (multi-informations) =================
async function extractWithGroq(message, currentSummary) {
    const prompt = `
Tu es un assistant médical. Tu dois extraire TOUTES les informations médicales présentes dans le message en UNE SEULE FOIS.

Message utilisateur: "${message}"

Informations déjà collectées: ${JSON.stringify(currentSummary)}

Règles IMPORTANTES:
- Extrais la DURÉE si mentionnée (ex: "depuis 4 jours", "3 heures", "5 jours")
- Extrais l'ÂGE si mentionné (ex: "40 ans", "j'ai 40 ans", "âge 40", "35 ans")
- Extrais le SYMPTÔME (ex: "fièvre", "douleur", "toux", "nausée")
- Extrais la PARTIE DU CORPS si mentionnée (ex: "poitrine", "tête", "ventre")
- Extrais la LOCALISATION si mentionnée (ex: "Casablanca", "Rabat")
- Si une information n'est PAS mentionnée dans le message, mets NULL
- N'invente JAMAIS de valeur
- RÉPONDS STRICTEMENT EN JSON

Exemple pour "5 jours et j'ai 40 ans":
{
  "symptom": null,
  "bodyPart": null,
  "duration": "5 jours",
  "intensity": null,
  "age": 40,
  "patientLocation": null
}

Exemple pour "j'ai mal à la tête depuis 3 jours et j'ai 35 ans":
{
  "symptom": "douleur",
  "bodyPart": "tete",
  "duration": "3 jours",
  "intensity": null,
  "age": 35,
  "patientLocation": null
}

Exemple pour "j'ai de la fièvre depuis 4 jours":
{
  "symptom": "fievre",
  "bodyPart": null,
  "duration": "4 jours",
  "intensity": null,
  "age": null,
  "patientLocation": null
}

Réponds MAINTENANT en JSON UNIQUEMENT, sans texte supplémentaire:
`;

    const response = await callGroq(prompt);
    console.log(`📝 [GROQ] Réponse brute: ${response.substring(0, 200)}...`);
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`✅ [GROQ] Extraction réussie:`, parsed);
            return parsed;
        } catch (e) {
            console.error("❌ Erreur parsing JSON Groq:", e.message);
            return {};
        }
    }
    return {};
}

// ================= VALIDATION =================
function validateExtracted(extracted) {
    const validated = {};
    if (extracted.age !== undefined && extracted.age !== null) {
        const age = Number(extracted.age);
        if (!isNaN(age) && age >= 0 && age <= 120) validated.age = age;
        else console.warn(`Âge invalide rejeté : ${extracted.age}`);
    }
    if (extracted.intensity !== undefined && extracted.intensity !== null) {
        const intensity = Number(extracted.intensity);
        if (!isNaN(intensity) && intensity >= 1 && intensity <= 10) validated.intensity = intensity;
        else console.warn(`Intensité invalide rejetée : ${extracted.intensity}`);
    }
    for (const field of ['symptom', 'bodyPart', 'duration', 'patientLocation']) {
        if (extracted[field] && typeof extracted[field] === 'string' && extracted[field].trim()) {
            validated[field] = extracted[field].trim();
        }
    }
    return validated;
}

// ================= QUESTION =================
async function askQuestion(field, wasEmpty = false) {
    const questions = {
        symptom: "Quel est le problème principal ?",
        bodyPart: "Où avez-vous mal ?",
        duration: "Depuis quand ?",
        age: "Quel âge a le patient ?",
        patientLocation: "Où se trouve le patient ?"
    };
    return wasEmpty ? `Je n'ai pas bien compris. ${questions[field]}` : questions[field];
}

// ================= EXTRACTION ÂGE SIMPLE =================
function extractAgeFromMessage(message) {
    const normalized = message.toLowerCase();
    
    const explicitAgeMatch = normalized.match(/(\d+)\s*(?:ans|années?)\b/);
    if (explicitAgeMatch) {
        const age = parseInt(explicitAgeMatch[1], 10);
        if (!isNaN(age) && age >= 0 && age <= 120) {
            console.log(`📝 Âge extrait (explicite): ${age}`);
            return age;
        }
    }
    
    const justNumber = normalized.match(/^\s*(\d+)\s*$/);
    if (justNumber) {
        const age = parseInt(justNumber[1], 10);
        if (!isNaN(age) && age >= 0 && age <= 120) {
            console.log(`📝 Âge extrait (nombre seul): ${age}`);
            return age;
        }
    }
    
    return null;
}

// ================= CONSEIL POUR RAG NON CRITIQUE =================
function getNonUrgentAdvice(key) {
    const adviceMap = {
        'fievre_general': "💡 **Conseil médical**\n\nReposez-vous et hydratez-vous. Prenez du paracétamol si nécessaire. Consultez un médecin si la fièvre dépasse 40°C ou persiste plus de 3 jours.",
        'cephalee_tete': "💡 **Conseil médical**\n\nReposez-vous dans un endroit calme et sombre. Hydratez-vous. Si la douleur est soudaine et violente, consultez immédiatement.",
        'douleur_abdominale_abdomen': "💡 **Conseil médical**\n\nNe mangez pas de repas copieux. Évitez les anti-inflammatoires. Consultez si la douleur persiste ou s'aggrave.",
        'default': "💡 **Conseil médical**\n\nSurveillez vos symptômes. Consultez un médecin si la situation ne s'améliore pas."
    };
    return adviceMap[key] || adviceMap.default;
}

// ================= PROCESSUS PRINCIPAL =================
async function processMessageGroq(userMessage, currentSummary = {}, sessionId = null) {
    // 1. Message vide ?
    const wasEmpty = !userMessage || userMessage.trim().length < 2;
    if (wasEmpty) {
        const missing = getMissing(currentSummary);
        const next = missing[0] || 'symptom';
        return {
            reply: await askQuestion(next, true),
            extractedInfo: {},
            intent: "reask",
            confidence: 0
        };
    }

    // 2. Détection des mots d'urgence
    const urgentKeywords = ['urgence', 'secours', 'aide', 'help', 'au secours', 'عاون', 'عيطو', 'الإسعاف'];
    const isUrgent = urgentKeywords.some(k => userMessage.toLowerCase().includes(k));
    
    if (isUrgent) {
        console.log("🚨 [URGENCE] Mot-clé d'aide détecté");
        return await escaladeUrgence(currentSummary, sessionId, "Mot-clé d'aide détecté", 1.0);
    }

    // 3. Extraction de l'âge (fallback simple)
    const extractedAge = extractAgeFromMessage(userMessage);
    let updatedSummary = { ...currentSummary };
    
    if (extractedAge !== null && !updatedSummary.age) {
        updatedSummary.age = extractedAge;
        console.log(`📝 Âge extrait du message: ${extractedAge} ans`);
    }

    // ================= ÉTAPE RAG =================
    const ragResponse = await getRAGResponse(userMessage);
    let ragConfidence = ragResponse.confidence || 0;
    
    // Cas critique RAG
    if (ragResponse.matched && ragResponse.urgency === true) {
        console.log(`📚 [RAG] Cas critique détecté: ${ragResponse.key} (confiance: ${Math.round(ragConfidence * 100)}%)`);
        
        if (ragResponse.key && ragResponse.key.includes('douleur_poitrine')) {
            updatedSummary.symptom = 'douleur';
            updatedSummary.bodyPart = 'poitrine';
        } else if (ragResponse.key && ragResponse.key.includes('respiration')) {
            updatedSummary.symptom = 'dyspnee';
        }
        
        await sendEmergencySMS(updatedSummary, sessionId, `RAG: ${ragResponse.key}`, ragConfidence);
        
        return {
            reply: `🚨 **URGENCE MÉDICALE**\n\n${ragResponse.reply}\n\n⚠️ **Appelez immédiatement le SAMU (141)**.\n\nRestez calme et allongez-vous.`,
            intent: "rag_critical",
            extractedInfo: { symptom: updatedSummary.symptom, bodyPart: updatedSummary.bodyPart },
            confidence: Math.max(ragConfidence, 0.7)
        };
    }
    
    // Cas non critique RAG
    if (ragResponse.matched && ragResponse.urgency === false && ragConfidence >= RAG_CONFIDENCE_THRESHOLD) {
        console.log(`📚 [RAG] Conseil non urgent: ${ragResponse.key} (confiance: ${Math.round(ragConfidence * 100)}%)`);
        
        if (ragResponse.key && ragResponse.key.includes('fievre')) updatedSummary.symptom = 'fievre';
        if (ragResponse.key && ragResponse.key.includes('cephalee')) updatedSummary.symptom = 'mal_tete';
        
        const advice = getNonUrgentAdvice(ragResponse.key);
        const missing = getMissing(updatedSummary);
        
        if (missing.length === 0) {
            if (sessionId) await sendToPFA(updatedSummary, sessionId);
            return {
                reply: `${advice}\n\n✅ Informations complètes.`,
                extractedInfo: { symptom: updatedSummary.symptom },
                intent: "complete",
                confidence: ragConfidence
            };
        } else {
            const nextField = missing[0];
            return {
                reply: `${advice}\n\n📋 ${await askQuestion(nextField)}`,
                extractedInfo: { symptom: updatedSummary.symptom },
                intent: "collect",
                confidence: ragConfidence
            };
        }
    }

    // ================= ÉTAPE GROQ =================
    console.log("🤖 [GROQ] Appel à Groq pour extraction multi-informations");
    let extracted = {};
    let lastError = null;
    let groqConfidence = 0.7;
    
    for (let i = 0; i < MAX_GROQ_RETRIES; i++) {
        try {
            extracted = await extractWithGroq(userMessage, updatedSummary);
            lastError = null;
            groqConfidence = calculateGroqConfidence(extracted, i);
            break;
        } catch (err) {
            lastError = err;
            console.error(`Tentative ${i+1}/${MAX_GROQ_RETRIES} échouée:`, err.message);
        }
    }
    
    if (lastError) {
        return await escaladeUrgence(updatedSummary, sessionId, "Groq failed after retries", 0.3);
    }

    const validated = validateExtracted(extracted);
    updatedSummary = { ...updatedSummary, ...validated };
    
    console.log(`📊 [GROQ] Summary après extraction:`, JSON.stringify(updatedSummary));
    
    const severity = evaluateSeverity(updatedSummary);

    if (severity === 'critique') {
        console.warn(`🚨 [URGENCE] Situation critique (${severity}) - Envoi SMS`);
        await sendEmergencySMS(updatedSummary, sessionId, `Critique: ${severity}`, groqConfidence);
    }

    const missing = getMissing(updatedSummary);
    
    if (missing.length === 0) {
        if (sessionId) await sendToPFA(updatedSummary, sessionId);
        return {
            reply: `Merci. Informations complètes.\n🚨 Niveau d'urgence: ${severity}`,
            extractedInfo: validated,
            intent: "complete",
            confidence: groqConfidence
        };
    }

    return {
        reply: await askQuestion(missing[0]),
        extractedInfo: validated,
        intent: "collect",
        confidence: groqConfidence
    };
}

module.exports = { processMessageGroq, escaladeUrgence };