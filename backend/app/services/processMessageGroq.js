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
        console.error("❌ SMS échoué:", error.response?.data || error.message);
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

// ================= ESCALADE URGENCE STANDARD =================
async function escaladeUrgence(summary, sessionId, reason, confidence = null) {
    console.warn(`🟠 [ESCALADE STANDARD] ${reason}`);
    await sendEmergencySMS(summary, sessionId, reason);
    await sendToPFA(summary, sessionId);
    const lang = detectLanguage(JSON.stringify(summary));
    const reply = lang === 'ar' ?
        `⚠️ **تنبيه طبي**\n\nتم إرسال تنبيه للفريق الطبي.\n\nاتصل بالإسعاف على الرقم **141** إذا تفاقمت الحالة.` :
        `⚠️ **Alerte médicale**\n\nUne alerte a été envoyée à l'équipe médicale.\n\nAppelez le **SAMU** au **141** si la situation s'aggrave.`;
    return {
        reply: reply,
        intent: "escalade_urgence",
        extractedInfo: summary,
        confidence: confidence || 0
    };
}

// ================= RÉPONSE URGENCE CRITIQUE (IMMÉDIATE) =================
async function handleCriticalEmergency(userMessage, summary, sessionId, lang) {
    console.log(`🔴🔴🔴 [ACTION IMMÉDIATE] URGENCE CRITIQUE DÉTECTÉE 🔴🔴🔴`);
    console.log(`📨 Message: "${userMessage}"`);
    
    // 1. ENVOYER SMS D'URGENCE IMMÉDIATEMENT
    await sendEmergencySMS(summary, sessionId, "URGENCE CRITIQUE - ACTION IMMÉDIATE REQUISE");
    
    // 2. ENVOYER AU PFA
    await sendToPFA(summary, sessionId);
    
    // 3. RÉPONSE D'URGENCE SANS POSER DE QUESTIONS
    const criticalResponse = lang === 'ar' ?
        `🚨🚨 **حالة طارئة جداً - تصرف فوري** 🚨🚨

هذه حالة طبية خطيرة تتطلب تدخلاً فورياً.

**📞 اتصل بالإسعاف فوراً على الرقم 141**

**ما يجب فعله فوراً :**

1. **اتصل بالرقم 141** - أخبرهم بما حدث
2. **لا تحرك الشخص** - إلا إذا كان في خطر إضافي
3. **افتح المجاري التنفسية** - إذا كان الشخص فاقداً للوعي
4. **تحقق من التنفس** - إذا كان لا يتنفس، ابدأ الإنعاش القلبي الرئوي

**إذا كنت أنت المصاب :**
- استلقِ في وضع مريح
- لا تأكل ولا تشرب أي شيء
- انتظر وصول الإسعاف

🚨 **طلب المساعدة فوراً هو الخيار الصحيح** 🚨

تم إرسال تنبيه للفريق الطبي.` :
        `🚨🚨 **URGENCE CRITIQUE - ACTION IMMÉDIATE REQUISE** 🚨🚨

Cette situation médicale est grave et nécessite une intervention immédiate.

**📞 APPELEZ LE SAMU IMMÉDIATEMENT : 141**

**CONDUITE À TENIR :**

1. **APPELER LE 141** - Décrivez précisément la situation
2. **NE PAS DÉPLACER LA PERSONNE** (sauf danger immédiat)
3. **DÉGAGER LES VOIES AÉRIENNES** - Si la personne est inconsciente
4. **VÉRIFIER LA RESPIRATION** - Si absent, commencer la RCP
5. **RASSURER LA PERSONNE** - Restez calme et parlez-lui

**Si vous êtes la personne concernée :**
- Allongez-vous ou asseyez-vous confortablement
- Ne mangez ni ne buvez rien
- Attendez l'arrivée des secours

🚨 **Ne perdez pas de temps - Appelez le SAMU (141) maintenant !** 🚨

Une alerte a été envoyée à l'équipe médicale.`;
    
    return {
        reply: criticalResponse,
        intent: "critical_emergency",
        extractedInfo: summary,
        confidence: 1.0,
        escalated: true
    };
}

// ================= DÉTECTION URGENCE TRÈS GRAVE =================
function isCriticalEmergency(message, summary) {
    // MOTS-CLÉS D'URGENCE CRITIQUE (déclenchement immédiat)
    const criticalKeywords = [
        // Français
        'crise cardiaque', 'infarctus', 'arrêt cardiaque', 'arrêt respiratoire',
        'ne respire plus', 'ne respire pas', 'étouffement', 'inconscience', 'évanouissement',
        'perte de connaissance', 'coma', 'hémorragie grave', 'saignement abondant',
        'traumatisme crânien', 'accident grave', 'chute haute', 'noyade',
        'difficulté à respirer', 'ne peut plus respirer', 'suffocation',
        
        // Arabe
        'سكتة قلبية', 'نوبة قلبية', 'توقف القلب', 'توقف التنفس',
        'لا يتنفس', 'اختناق', 'فقدان الوعي', 'غيبوبة', 'نزيف حاد',
        'إصابة خطيرة', 'حادث خطير', 'صعوبة في التنفس'
    ];
    
    const msg = message.toLowerCase();
    const sym = (summary.symptom || '').toLowerCase();
    const bp = (summary.bodyPart || '').toLowerCase();
    
    // Vérifier les mots-clés critiques
    for (const kw of criticalKeywords) {
        if (msg.includes(kw) || sym.includes(kw)) {
            console.log(`🚨🚨🚨 [URGENCE CRITIQUE] Mot-clé détecté: "${kw}"`);
            return true;
        }
    }
    
    // Douleur thoracique + symptômes associés = URGENCE CRITIQUE
    if ((sym.includes('douleur') || msg.includes('douleur')) && 
        (bp.includes('poitrine') || msg.includes('poitrine') || bp.includes('thorax'))) {
        
        const associatedSymptoms = [
            'essoufflement', 'sueur', 'nausée', 'vomissement', 
            'bras gauche', 'mâchoire', 'dos', 'fatigue intense', 'vertige'
        ];
        
        for (const symp of associatedSymptoms) {
            if (msg.includes(symp)) {
                console.log(`🚨🚨🚨 [URGENCE CRITIQUE] Douleur thoracique + ${symp}`);
                return true;
            }
        }
    }
    
    return false;
}

// ================= VÉRIFICATION URGENCE STANDARD =================
function checkEmergency(message, summary) {
    const urgentKeywords = [
        'urgence', 'secours', 'samu', 'hémorragie', 'hemorragie', 'perte de sang',
        'دعاء', 'مساعدة', 'الإسعاف', 'نزيف', 'saignement',
        'douleur thoracique', 'étouffement', 'inconscience', 'évanouissement',
        'crise cardiaque', 'infarctus', 'arrêt respiratoire', 'coma',
        'difficulté à respirer'
    ];
    const msg = message.toLowerCase();
    const sym = (summary.symptom || '').toLowerCase();
    return urgentKeywords.some(kw => msg.includes(kw) || sym.includes(kw));
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
            console.log(`✅ [RAG] ${results.length} résultat(s) - Score: ${results[0].similarity}`);
        } else {
            console.log(`⚠️ [RAG] Aucun résultat trouvé`);
        }
        
        return results;
    } catch (error) {
        console.error("❌ [RAG] Erreur:", error.message);
        return [];
    }
}

// ================= GÉNÉRER RÉPONSE MÉDICALE INTELLIGENTE =================
async function generateMedicalResponse(userMessage, ragResults, summary, language) {
    const hasRelevantRAG = ragResults.length > 0 && ragResults[0].similarity > 0.5;
    
    let prompt = "";
    
    if (hasRelevantRAG) {
        const relevantDoc = ragResults[0];
        const ragContent = relevantDoc.content;
        const ragScore = Math.round(relevantDoc.similarity * 100);
        
        prompt = `Tu es un assistant médical expert. Voici une question d'un patient et des informations médicales pertinentes trouvées dans notre base.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 INFORMATIONS MÉDICALES TROUVÉES (Pertinence: ${ragScore}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ragContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 PATIENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Message: "${userMessage}"
Symptôme: ${summary.symptom || "À déterminer"}
Localisation: ${summary.bodyPart || "Non spécifiée"}
Âge: ${summary.age || "Non spécifié"} ans

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSIGNES :
1. UTILISE OBLIGATOIREMENT les informations médicales ci-dessus
2. ADAPTE ces informations au patient
3. Donne des conseils pratiques
4. Langue: ${language === 'ar' ? 'Arabe' : 'Français'}

RÉPONSE :`;
    } else {
        prompt = `Tu es un assistant médical expert.

MESSAGE PATIENT: "${userMessage}"
Symptôme: ${summary.symptom || "Non spécifié"}
Localisation: ${summary.bodyPart || "Non spécifiée"}
Âge: ${summary.age || "Non spécifié"} ans

Consignes :
1. Réponds directement à la question
2. Si c'est une urgence → commence par "🚨 URGENCE :"
3. Pose des questions pertinentes si besoin
4. Langue: ${language === 'ar' ? 'Arabe' : 'Français'}

RÉPONSE :`;
    }

    try {
        const response = await callGroq(prompt);
        return response.trim();
    } catch (error) {
        console.error("❌ Erreur Groq:", error.message);
        return language === 'ar' ? 
            "Je n'ai pas pu traiter votre demande." :
            "Je n'ai pas pu traiter votre demande.";
    }
}

// ================= EXTRACTION GROQ =================
async function extractWithGroq(message, currentSummary) {
    const prompt = `
Extrais les infos cliniques du message au format JSON.
Message: "${message}"

Réponds STRICTEMENT en JSON:
{
  "symptom": "symptôme ou null",
  "bodyPart": "partie du corps ou null",
  "duration": "durée ou null",
  "age": "nombre ou null",
  "patientLocation": "lieu ou null",
  "intensity": "nombre 1-10 ou null"
}`;

    try {
        const response = await callGroq(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return {};
    } catch (e) {
        console.error("❌ Erreur extraction:", e.message);
        return {};
    }
}

// ================= QUESTION =================
async function askQuestion(field, lang = 'fr') {
    const questions = {
        fr: {
            symptom: "Quel est le problème principal ?",
            bodyPart: "Où exactement ?",
            duration: "Depuis quand ?",
            age: "Quel âge a le patient ?",
            patientLocation: "Où se trouve le patient ?"
        },
        ar: {
            symptom: "ما هي المشكلة الرئيسية؟",
            bodyPart: "أين بالضبط؟",
            duration: "منذ متى؟",
            age: "كم عمر المريض؟",
            patientLocation: "أين يوجد المريض؟"
        }
    };
    return questions[lang][field] || questions.fr[field];
}

// ================= PROCESSUS PRINCIPAL =================
async function processMessageGroq(userMessage, currentSummary = {}, sessionId = null) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📨 [MESSAGE] "${userMessage}"`);
    console.log(`${'='.repeat(60)}`);

    const lang = detectLanguage(userMessage);
    
    // ✅ 1. URGENCE CRITIQUE (priorité ABSOLUE)
    if (isCriticalEmergency(userMessage, currentSummary)) {
        console.log("🔴🔴🔴 [URGENCE CRITIQUE] Déclenchement immédiat!");
        return await handleCriticalEmergency(userMessage, currentSummary, sessionId, lang);
    }
    
    // ✅ 2. URGENCE STANDARD
    if (checkEmergency(userMessage, currentSummary)) {
        console.log("🟠 [URGENCE STANDARD] Niveau d'alerte");
        
        // Vérifier si on a les infos essentielles
        if (!currentSummary.age || !currentSummary.symptom) {
            const reply = lang === 'ar' ?
                `⚠️ **حالة طارئة**\n\nسأطرح عليك أسئلة سريعة.\n\nما هو عمر المريض؟` :
                `⚠️ **Situation d'urgence**\n\nJe vais vous poser rapidement quelques questions.\n\nQuel âge a le patient ?`;
            return {
                reply: reply,
                extractedInfo: {},
                intent: "emergency_collect",
                severity: "critique"
            };
        }
        
        return await escaladeUrgence(currentSummary, sessionId, "Urgence standard", 0.9);
    }
    
    // ✅ 3. RECHERCHE RAG
    console.log("\n🔍 [RAG] Recherche...");
    const ragResults = await searchRAG(userMessage, lang);
    
    // ✅ 4. RÉPONSE MÉDICALE
    console.log("\n💬 [GROQ] Génération réponse...");
    const medicalResponse = await generateMedicalResponse(userMessage, ragResults, currentSummary, lang);
    
    // ✅ 5. EXTRACTION DES INFOS
    let extracted = await extractWithGroq(userMessage, currentSummary);
    
    // ✅ 6. MISE À JOUR
    const updatedSummary = {
        ...currentSummary,
        ...Object.fromEntries(
            Object.entries(extracted).filter(([_, v]) => v !== null && v !== "" && v !== undefined)
        )
    };
    delete updatedSummary._complete;
    console.log(`📊 [RÉSUMÉ]`, JSON.stringify(updatedSummary));

    // ✅ 7. SÉVÉRITÉ
    let severity = evaluateSeverity(updatedSummary);
    if (updatedSummary.symptom && 
        (updatedSummary.symptom.includes('hémorragie') || 
         updatedSummary.symptom.includes('نزيف') || 
         updatedSummary.symptom.includes('douleur thoracique'))) {
        severity = 'critique';
    }
    console.log(`⚠️ [SÉVÉRITÉ] ${severity}`);

    const missing = getMissing(updatedSummary);
    console.log(`📋 [MANQUANTS] ${missing.length > 0 ? missing.join(', ') : 'Aucun'}`);

    // ✅ 8. COLLECTE COMPLÈTE
    if (missing.length === 0) {
        console.log(`✅ [COMPLET] Envoi au PFA...`);
        await sendToPFA(updatedSummary, sessionId);
        
        const completionReply = lang === 'ar' ?
            `✅ **تم جمع المعلومات**\n\n📋 الأعراض: ${updatedSummary.symptom}\n📍 الموقع: ${updatedSummary.bodyPart || 'غير محدد'}\n⏱️ المدة: ${updatedSummary.duration}\n👤 العمر: ${updatedSummary.age} سنة\n\n🚨 المستوى: ${severity}\n\n${medicalResponse}` :
            `✅ **Informations complètes**\n\n📋 Symptôme: ${updatedSummary.symptom}\n📍 Localisation: ${updatedSummary.bodyPart || 'Non spécifiée'}\n⏱️ Durée: ${updatedSummary.duration}\n👤 Âge: ${updatedSummary.age} ans\n\n🚨 Urgence: ${severity}\n\n${medicalResponse}`;
        
        return {
            reply: completionReply,
            extractedInfo: extracted,
            intent: "complete",
            severity,
            esoSummary: updatedSummary,
            updatedSummary: { ...updatedSummary, _complete: true },
            ragUsed: ragResults.length > 0
        };
    }

    // ✅ 9. QUESTION SUIVANTE
    const nextField = missing[0];
    const missingQuestion = await askQuestion(nextField, lang);
    const finalReply = `${medicalResponse}\n\n${missingQuestion}`;

    return {
        reply: finalReply,
        extractedInfo: extracted,
        intent: "collect",
        severity,
        updatedSummary,
        ragUsed: ragResults.length > 0,
        missingFields: missing
    };
}

module.exports = { processMessageGroq, escaladeUrgence, handleCriticalEmergency };