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

// ================= DÉTECTION LANGUE =================
function detectLanguage(message) {
    const arabicChars = (message.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = message.replace(/\s/g, '').length;
    return arabicChars / totalChars > 0.2 ? 'ar' : 'fr';
}

// ================= ENVOI SMS URGENCE =================
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
        if (error.response && error.response.data) {

            console.error(
                "❌ SMS échoué:",
                error.response.data
            );

        } else {

            console.error(
                "❌ SMS échoué:",
                error.message
            );
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

// ================= RECHERCHE DANS LA RAG =================
async function searchRAG(query, language = 'fr') {
    console.log(`🔍 [RAG] Recherche: "${query}"`);
    try {
        const response = await axios.post('http://localhost:5001/search', {
            query: query,
            language: language,
            top_k: 3
        });
        const results = response.data.results || [];
        if (results.length > 0) {
            console.log(`✅ [RAG] ${results.length} résultat(s) - Score: ${results[0].similarity?.toFixed(3)}`);
        } else {
            console.log(`⚠️ [RAG] Aucun résultat pertinent`);
        }
        return results;
    } catch (error) {
        console.error("❌ [RAG] Erreur:", error.message);
        return [];
    }
}

// ================= EXTRACTION INTELLIGENTE PAR LLM =================
// On laisse le LLM comprendre le sens plutôt que de chercher des mots-clés
async function extractWithGroq(message, currentSummary, conversationHistory = []) {
    const historyText = conversationHistory.slice(-6).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const prompt = `Tu es un assistant médical expert en extraction d'informations cliniques.

HISTORIQUE DE LA CONVERSATION (pour le contexte) :
${historyText || "(Début de conversation)"}

NOUVEAU MESSAGE DU PATIENT : "${message}"

DONNÉES DÉJÀ COLLECTÉES :
${JSON.stringify(currentSummary, null, 2)}

Ta tâche : extraire ou mettre à jour les informations cliniques à partir du nouveau message.
Tiens compte de l'historique pour comprendre le contexte (ex: si on a demandé l'âge et le patient répond "32 ans", c'est l'âge).

RÈGLES D'EXTRACTION :
- "ça fait mal" ou "j'ai mal" → symptom = "douleur"
- "depuis ce matin", "depuis 2 jours" → duration
- "j'ai 45 ans", "mon fils a 8 ans", "pour ma mère" → age (extraire le chiffre)
- "je suis à Casablanca", "chez moi", "à l'école" → patientLocation
- "à la tête", "le ventre", "mon bras droit" → bodyPart
- Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après.
- Pour chaque champ : mets la valeur extraite, ou null si absent dans ce message.
- Ne supprime PAS les champs déjà collectés — retourne null uniquement si vraiment absent du message actuel.

FORMAT JSON ATTENDU :
{
  "symptom": "description claire du symptôme principal ou null",
  "bodyPart": "partie du corps concernée ou null",
  "duration": "durée exprimée naturellement ou null",
  "age": "nombre entier ou null",
  "patientLocation": "lieu ou null",
  "intensity": "nombre de 1 à 10 ou null",
  "additionalSymptoms": ["liste de symptômes secondaires"] ou [],
  "medicalHistory": "antécédents mentionnés ou null",
  "currentMedication": "médicaments mentionnés ou null",
  "emergencyLevel": "critique|urgent|modere|faible — ton évaluation basée sur le contexte complet"
}`;

    try {
        const response = await callGroq(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`🧠 [EXTRACTION LLM]`, JSON.stringify(parsed));
            return parsed;
        }
        return {};
    } catch (e) {
        console.error("❌ Erreur extraction LLM:", e.message);
        return {};
    }
}

// ================= ÉVALUATION URGENCE PAR LLM =================
// Plus de listes de mots-clés — le LLM évalue la gravité en contexte
async function evaluateEmergencyByLLM(userMessage, summary, conversationHistory = []) {
    const historyText = conversationHistory.slice(-4).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const prompt = `Tu es un médecin urgentiste expérimenté. Évalue la gravité de cette situation.

CONTEXTE DE LA CONVERSATION :
${historyText || "(Premier message)"}

MESSAGE ACTUEL : "${userMessage}"

INFORMATIONS COLLECTÉES :
- Symptôme: ${summary.symptom || 'non précisé'}
- Localisation: ${summary.bodyPart || 'non précisée'}
- Durée: ${summary.duration || 'non précisée'}
- Âge: ${summary.age || 'non précisé'}
- Intensité: ${summary.intensity || 'non précisée'}/10

Réponds UNIQUEMENT avec un JSON valide :
{
  "level": "critique|urgent|modere|faible",
  "reasoning": "explication courte en 1 phrase",
  "needsImmediateAction": true|false,
  "recommendedAction": "appeler le 141|consultation urgente|consultation normale|conseil médical"
}

NIVEAUX :
- critique: danger de mort immédiat (AVC, infarctus, détresse respiratoire sévère, hémorragie massive, perte de conscience, traumatisme grave...)
- urgent: nécessite une consultation dans les heures qui suivent
- modere: consultation dans la journée ou le lendemain
- faible: conseil médical suffit`;

    try {
        const response = await callGroq(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log(`⚠️ [URGENCE LLM] Niveau: ${result.level} | ${result.reasoning}`);
            return result;
        }
        return { level: 'modere', needsImmediateAction: false, recommendedAction: 'conseil médical' };
    } catch (e) {
        console.error("❌ Erreur évaluation urgence:", e.message);
        return { level: 'modere', needsImmediateAction: false };
    }
}

// ================= RÉPONSE URGENCE CRITIQUE =================
async function handleCriticalEmergency(userMessage, summary, sessionId, lang, reasoning = '') {
    console.log(`🔴🔴🔴 [ACTION IMMÉDIATE] URGENCE CRITIQUE 🔴🔴🔴`);

    await sendEmergencySMS(summary, sessionId, `URGENCE CRITIQUE - ${reasoning}`);
    await sendToPFA(summary, sessionId);

    const criticalResponse = lang === 'ar' ?
        `🚨🚨 **حالة طارئة جداً - تصرف فوري** 🚨🚨

هذه حالة طبية خطيرة تتطلب تدخلاً فورياً.

**📞 اتصل بالإسعاف فوراً على الرقم 141**

**ما يجب فعله الآن :**
1. **اتصل بالرقم 141** — أخبرهم بما يحدث بالضبط
2. **لا تحرك الشخص** — إلا إذا كان في خطر إضافي
3. **تحقق من التنفس** — إذا توقف، ابدأ الإنعاش القلبي الرئوي
4. **افتح المجاري التنفسية** — إذا كان فاقداً للوعي
5. **ابقَ بالقرب منه** — حتى وصول الإسعاف

تم إرسال تنبيه للفريق الطبي. 🚨` :
        `🚨🚨 **URGENCE CRITIQUE — ACTION IMMÉDIATE** 🚨🚨

**📞 APPELEZ LE SAMU IMMÉDIATEMENT : 141**

**À faire maintenant :**
1. **Appelez le 141** — décrivez précisément la situation
2. **Ne déplacez pas la personne** (sauf danger immédiat)
3. **Vérifiez la respiration** — si absente, commencez la RCP
4. **Dégagez les voies aériennes** si inconsciente
5. **Restez auprès d'elle** jusqu'à l'arrivée des secours

Une alerte a été envoyée à l'équipe médicale. 🚨`;

    return {
        reply: criticalResponse,
        intent: "critical_emergency",
        extractedInfo: summary,
        severity: "critique",
        escalated: true
    };
}

// ================= ESCALADE URGENCE STANDARD =================
async function escaladeUrgence(summary, sessionId, reasoning, lang) {
    console.warn(`🟠 [ESCALADE URGENTE] ${reasoning}`);
    await sendEmergencySMS(summary, sessionId, reasoning);
    await sendToPFA(summary, sessionId);

    const reply = lang === 'ar' ?
        `⚠️ **تنبيه طبي**\n\nتم إرسال تنبيه للفريق الطبي.\n\nاتصل بالإسعاف على الرقم **141** إذا تفاقمت الحالة.` :
        `⚠️ **Alerte médicale**\n\nUne alerte a été envoyée à l'équipe médicale.\n\nAppelez le **SAMU** au **141** si la situation s'aggrave.`;

    return {
        reply,
        intent: "escalade_urgence",
        extractedInfo: summary,
        severity: "urgent",
        escalated: true
    };
}

// ================= GÉNÉRATION RÉPONSE MÉDICALE INTELLIGENTE =================
async function generateSmartResponse(userMessage, ragResults, summary, conversationHistory, emergencyEval, lang, missingFields) {
    const historyText = conversationHistory.slice(-8).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Médecin IA'}: ${m.content}`
    ).join('\n');

    const ragContext = ragResults.length > 0 && ragResults[0].similarity > 0.45 ?
        `\n\nINFORMATIONS MÉDICALES PERTINENTES (pertinence: ${Math.round(ragResults[0].similarity * 100)}%) :\n${ragResults[0].content}` :
        '';

    const collectedInfo = Object.entries(summary)
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

    const nextQuestion = missingFields.length > 0 ? missingFields[0] : null;
    const questionGuide = nextQuestion ? `\nTu DOIS poser UNE question naturelle pour obtenir: "${nextQuestion}" — formule-la de façon conversationnelle, pas robotique.` : '';

    const prompt = `Tu es un médecin assistant bienveillant et expert. Tu as une conversation médicale en cours.

HISTORIQUE :
${historyText || "(Premier échange)"}

DERNIER MESSAGE DU PATIENT : "${userMessage}"

INFORMATIONS DÉJÀ COLLECTÉES :
${collectedInfo || "(aucune encore)"}

ÉVALUATION MÉDICALE :
- Niveau d'urgence: ${emergencyEval.level || 'non évalué'}
- Analyse: ${emergencyEval.reasoning || ''}
- Action recommandée: ${emergencyEval.recommendedAction || ''}
${ragContext}

CONSIGNES DE RÉPONSE :
1. Réponds DIRECTEMENT au message du patient — comprends ce qu'il dit vraiment
2. Sois empathique, humain, et professionnel
3. Si le patient exprime de la douleur, de l'inquiétude ou du stress : reconnais-le d'abord
4. Utilise les informations RAG si pertinentes, en les adaptant au contexte du patient
5. Ne répète PAS les infos déjà dites dans l'historique
6. ${questionGuide || "Donne tes recommandations médicales basées sur les informations collectées."}
7. Langue de réponse: ${lang === 'ar' ? 'Arabe (dialecte marocain compréhensible)' : 'Français naturel et clair'}
8. Format: texte naturel, utilise des **gras** pour les points importants, pas de listes à puces sauf si vraiment utile
9. Longueur: concis mais complet — max 4-5 lignes sauf si c'est une urgence

RÉPONSE :`;

    try {
        const response = await callGroq(prompt);
        return response.trim();
    } catch (error) {
        console.error("❌ Erreur génération réponse:", error.message);
        return lang === 'ar' ?
            "عذراً، لم أتمكن من معالجة طلبك. هل يمكنك إعادة المحاولة؟" :
            "Désolé, je n'ai pas pu traiter votre demande. Pouvez-vous réessayer ?";
    }
}

// ================= PROCESSUS PRINCIPAL =================
async function processMessageGroq(userMessage, currentSummary = {}, sessionId = null, conversationHistory = []) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📨 [MESSAGE] "${userMessage}"`);
    console.log(`📊 [RÉSUMÉ ACTUEL]`, JSON.stringify(currentSummary));
    console.log(`${'='.repeat(60)}`);

    const lang = detectLanguage(userMessage);
    console.log(`🌐 [LANGUE] ${lang}`);

    // ✅ 1. EXTRACTION INTELLIGENTE PAR LLM (comprend le contexte, pas de mots-clés)
    console.log("\n🧠 [EXTRACTION] Analyse sémantique...");
    const extracted = await extractWithGroq(userMessage, currentSummary, conversationHistory);

    // Fusionner les infos extraites avec l'existant (ne pas écraser avec null)
    const updatedSummary = {...currentSummary };
    for (const [key, value] of Object.entries(extracted)) {
        if (value !== null && value !== undefined && value !== '' &&
            !['additionalSymptoms', 'medicalHistory', 'currentMedication', 'emergencyLevel'].includes(key)) {
            updatedSummary[key] = value;
        }
    }
    // Enrichir avec les champs étendus
    if (
        extracted.additionalSymptoms &&
        extracted.additionalSymptoms.length > 0
    ) {
        updatedSummary.additionalSymptoms =
            extracted.additionalSymptoms;
    }
    if (extracted.medicalHistory) updatedSummary.medicalHistory = extracted.medicalHistory;
    if (extracted.currentMedication) updatedSummary.currentMedication = extracted.currentMedication;
    delete updatedSummary._complete;

    console.log(`📊 [RÉSUMÉ MIS À JOUR]`, JSON.stringify(updatedSummary));

    // ✅ 2. ÉVALUATION URGENCE PAR LLM (intelligence contextuelle)
    console.log("\n⚠️ [URGENCE] Évaluation intelligente...");
    const emergencyEval = await evaluateEmergencyByLLM(userMessage, updatedSummary, conversationHistory);

    // ✅ 3. URGENCE CRITIQUE → ACTION IMMÉDIATE
    if (emergencyEval.level === 'critique' && emergencyEval.needsImmediateAction) {
        return await handleCriticalEmergency(
            userMessage, updatedSummary, sessionId, lang, emergencyEval.reasoning
        );
    }

    // ✅ 4. URGENCE STANDARD → ESCALADE APRÈS COLLECTE MINIMALE
    if (emergencyEval.level === 'urgent' && emergencyEval.needsImmediateAction) {
        // Si on a les infos minimales, escalader
        if (updatedSummary.symptom && updatedSummary.age) {
            return await escaladeUrgence(updatedSummary, sessionId, emergencyEval.reasoning, lang);
        }
        // Sinon, collecter en urgence
        const urgentCollect = lang === 'ar' ?
            `⚠️ **وضع يستدعي الانتباه**\n\n${emergencyEval.reasoning}\n\nسأساعدك بسرعة. ما هو عمر المريض؟` :
            `⚠️ **Situation nécessitant attention**\n\n${emergencyEval.reasoning}\n\nJe vais vous aider rapidement. Quel est l'âge du patient ?`;
        return {
            reply: urgentCollect,
            extractedInfo: extracted,
            intent: "urgent_collect",
            severity: "urgent",
            updatedSummary
        };
    }

    // ✅ 5. RECHERCHE RAG
    console.log("\n🔍 [RAG] Recherche...");
    const searchQuery = updatedSummary.symptom ?
        `${updatedSummary.symptom} ${updatedSummary.bodyPart || ''} ${userMessage}`.trim() :
        userMessage;
    const ragResults = await searchRAG(searchQuery, lang);

    // ✅ 6. CHAMPS MANQUANTS
    const missing = getMissing(updatedSummary);
    console.log(`📋 [MANQUANTS] ${missing.length > 0 ? missing.join(', ') : 'Aucun'}`);

    // ✅ 7. GÉNÉRATION RÉPONSE INTELLIGENTE
    console.log("\n💬 [GROQ] Génération réponse intelligente...");
    const medicalResponse = await generateSmartResponse(
        userMessage, ragResults, updatedSummary, conversationHistory,
        emergencyEval, lang, missing
    );

    // ✅ 8. COLLECTE COMPLÈTE → ENVOYER AU PFA
    if (missing.length === 0) {
        console.log(`✅ [COMPLET] Toutes les infos collectées — envoi au PFA`);
        await sendToPFA(updatedSummary, sessionId);

        const severity = evaluateSeverity(updatedSummary);
        const completionPrefix = lang === 'ar' ?
            `✅ **تم جمع المعلومات الكاملة**\n\n` :
            `✅ **Dossier complet**\n\n`;

        return {
            reply: completionPrefix + medicalResponse,
            extractedInfo: extracted,
            intent: "complete",
            severity,
            esoSummary: updatedSummary,
            updatedSummary: {...updatedSummary, _complete: true },
            ragUsed: ragResults.length > 0
        };
    }

    // ✅ 9. CONTINUER LA COLLECTE NATURELLEMENT
    return {
        reply: medicalResponse,
        extractedInfo: extracted,
        intent: "collect",
        severity: emergencyEval.level,
        updatedSummary,
        ragUsed: ragResults.length > 0,
        missingFields: missing
    };
}

module.exports = { processMessageGroq, escaladeUrgence, handleCriticalEmergency };