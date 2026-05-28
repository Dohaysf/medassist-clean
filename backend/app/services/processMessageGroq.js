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

// ================= MAPPING SOURCES OFFICIELLES =================
const SOURCE_LABELS = {
    'MinSante_Maroc': 'Ministère de la Santé Maroc',
    'CroixRouge_ICRC': 'Croix-Rouge Internationale (CICR)',
    'IFRC': 'Fédération Internationale Croix-Rouge (IFRC)',
    'WHO': 'Organisation Mondiale de la Santé (OMS)',
};

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

// ================= HELPER : PROTOCOLE OFFICIEL UNIQUEMENT =================
async function getProtocoleFromRAG(summary, lang) {
    try {
        const ragResults = await searchRAG(
            `${summary.symptom || ''} ${summary.bodyPart || ''} urgence protocole premiers secours`.trim(),
            lang
        );
        for (const result of ragResults) {
            if (result.similarity > 0.3) {
                const sourceLabel = SOURCE_LABELS[result.source] || null;
                if (sourceLabel) {
                    console.log(`📋 [PROTOCOLE OFFICIEL] ${sourceLabel} (${result.similarity})`);
                    return { content: result.content, sourceLabel };
                }
            }
        }
    } catch (e) {
        console.error("❌ RAG protocole:", e.message);
    }
    return null;
}

// ================= CALCUL SCORE DE CONFIANCE =================
/**
 * Calcule le niveau de confiance de la réponse en fonction des résultats RAG.
 * @param {Array} ragResults - Résultats retournés par le RAG
 * @returns {{ level: string, source: string|null, score: number, label: string }}
 */
function computeConfidence(ragResults) {
    if (!ragResults || ragResults.length === 0) {
        return { level: 'unverified', source: null, score: 0, label: '⚠️ Non vérifié — aucune source disponible' };
    }

    // Chercher la meilleure source officielle
    for (const result of ragResults) {
        if (result.similarity > 0.3 && SOURCE_LABELS[result.source]) {
            return {
                level: 'verified',
                source: SOURCE_LABELS[result.source],
                score: result.similarity,
                label: `✅ Protocole officiel — ${SOURCE_LABELS[result.source]} (${Math.round(result.similarity * 100)}%)`
            };
        }
    }

    // Source non officielle mais contenu pertinent
    if (ragResults[0].similarity > 0.4) {
        return {
            level: 'partial',
            source: 'base médicale interne',
            score: ragResults[0].similarity,
            label: `🔵 Basé sur base médicale interne (${Math.round(ragResults[0].similarity * 100)}%)`
        };
    }

    return { level: 'unverified', source: null, score: ragResults[0].similarity, label: '⚠️ Non vérifié — source peu pertinente' };
}

// ================= EXTRACTION INTELLIGENTE PAR LLM =================
async function extractWithGroq(message, currentSummary, conversationHistory = [], userMedicalHistory = null, userAge = null, userGender = null) {
    const historyText = conversationHistory.slice(-6).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`
    ).join('\n');

    let antecedentsSection = '';
    if (userMedicalHistory) {
        const conditions = [];
        if (userMedicalHistory.diabete) conditions.push('- Diabète');
        if (userMedicalHistory.asthme) conditions.push('- Asthme');
        if (userMedicalHistory.tension) conditions.push('- Hypertension');
        if (userMedicalHistory.other) conditions.push(`- Autre: ${userMedicalHistory.other}`);

        if (conditions.length > 0) {
            antecedentsSection = `
INFORMATIONS CONNUES SUR LE PATIENT (issues de son profil) :
- Âge: ${userAge || 'Non renseigné'} ans
- Sexe: ${userGender === 'homme' ? 'Homme' : userGender === 'femme' ? 'Femme' : 'Non renseigné'}
- Antécédents médicaux:
${conditions.join('\n')}

`;
        }
    }

    const prompt = `Tu es un assistant médical expert en extraction d'informations cliniques.

HISTORIQUE DE LA CONVERSATION (pour le contexte) :
${historyText || "(Début de conversation)"}

${antecedentsSection}
NOUVEAU MESSAGE DU PATIENT : "${message}"

DONNÉES DÉJÀ COLLECTÉES :
${JSON.stringify(currentSummary, null, 2)}

Ta tâche : extraire ou mettre à jour les informations cliniques à partir du nouveau message.
Tiens compte de l'historique pour comprendre le contexte (ex: si on a demandé l'âge et le patient répond "32 ans", c'est l'âge).
TIENS ÉGALEMENT COMPTE DES ANTÉCÉDENTS MÉDICAUX mentionnés ci-dessus pour mieux comprendre la situation.

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
async function evaluateEmergencyByLLM(userMessage, summary, conversationHistory = [], userMedicalHistory = null, userAge = null) {
    const historyText = conversationHistory.slice(-4).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`
    ).join('\n');

    let antecedentsInfo = '';
    if (userMedicalHistory) {
        const conditions = [];
        if (userMedicalHistory.diabete) conditions.push('diabète');
        if (userMedicalHistory.asthme) conditions.push('asthme');
        if (userMedicalHistory.tension) conditions.push('hypertension');

        if (conditions.length > 0) {
            antecedentsInfo = `\nANTÉCÉDENTS CONNUS : ${conditions.join(', ')}. Âge: ${userAge || 'non renseigné'} ans.`;
        }
    }

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
${antecedentsInfo}

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
- faible: conseil médical suffit

⚠️ IMPORTANT : Tiens compte des ANTÉCÉDENTS MÉDICAUX (diabète, asthme, hypertension) pour évaluer la gravité.`;

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

// ================= GESTION URGENCE CRITIQUE + URGENT (UNIFIÉE) =================
async function handleHighEmergency(userMessage, summary, sessionId, lang, level, reasoning) {
    const isCritique = level === 'critique';
    console.log(`${isCritique ? '🔴🔴🔴 URGENCE CRITIQUE' : '🟠 URGENCE STANDARD'} — ${reasoning}`);

    await sendEmergencySMS(summary, sessionId, `${level.toUpperCase()} - ${reasoning}`);
    await sendToPFA(summary, sessionId);
    console.log(`✅ Dossier envoyé au PFA (niveau: ${level})`);

    const protocole = await getProtocoleFromRAG(summary, lang);

    // =====================================================
    // OPTION B : LLM contraint — ne peut utiliser que le protocole RAG
    // =====================================================
    let firstAidPrompt;

    if (protocole) {
        // Protocole officiel disponible → contraindre strictement
        firstAidPrompt = `Tu es un médecin urgentiste. Génère des instructions de premiers secours IMMÉDIATES et PRÉCISES.

SITUATION : ${level === 'critique' ? 'URGENCE VITALE' : 'URGENCE MÉDICALE'}
Symptôme: ${summary.symptom || 'non précisé'}
Localisation: ${summary.bodyPart || 'non précisée'}
Âge: ${summary.age || 'non précisé'}
Analyse: ${reasoning}

PROTOCOLE OFFICIEL FOURNI (${protocole.sourceLabel}) :
${protocole.content}

⛔ RÈGLE ABSOLUE : Tu dois utiliser UNIQUEMENT les étapes contenues dans ce protocole officiel ci-dessus.
N'ajoute, n'invente et ne modifie aucune instruction qui n'y figure pas.
Adapte uniquement la formulation à la langue et au niveau d'urgence.

Génère les instructions en ${lang === 'ar' ? 'arabe dialectal marocain' : 'français'}.
Format : liste numérotée, actions concrètes, max 5 étapes issues du protocole.
${isCritique ? 'Commence par appeler le 141.' : 'Inclus quand consulter en urgence.'}
Réponds UNIQUEMENT avec les instructions, sans introduction.`;
    } else {
        // Aucun protocole RAG → instructions minimales de sécurité uniquement, sans improvisation
        firstAidPrompt = `Tu es un médecin urgentiste.

SITUATION : ${level === 'critique' ? 'URGENCE VITALE' : 'URGENCE MÉDICALE'}
Symptôme: ${summary.symptom || 'non précisé'}
Analyse: ${reasoning}

⛔ RÈGLE ABSOLUE : Aucun protocole officiel n'est disponible pour ce cas précis.
Tu NE DOIS PAS inventer des étapes médicales spécifiques.
Donne UNIQUEMENT les mesures de sécurité universelles ci-dessous, reformulées en ${lang === 'ar' ? 'arabe dialectal marocain' : 'français'} :

Mesures universelles autorisées :
1. Appelez immédiatement le 141
2. Allongez le patient dans une position confortable
3. Ne donnez aucun médicament sans avis médical
4. Surveillez la respiration et le niveau de conscience
5. Ne laissez pas le patient seul jusqu'à l'arrivée des secours

Réponds UNIQUEMENT avec ces 5 étapes adaptées à la langue, sans ajouter d'autres instructions.`;
    }

    let firstAidInstructions = '';
    try {
        firstAidInstructions = await callGroq(firstAidPrompt);
        firstAidInstructions = firstAidInstructions.trim();
    } catch (e) {
        console.error("❌ Erreur génération premiers secours:", e.message);
        firstAidInstructions = lang === 'ar' ?
            '1. اتصل بالإسعاف على الرقم 141\n2. أبقِ المريض في وضع مريح\n3. لا تترك المريض وحده' :
            '1. Appelez le 141\n2. Maintenez le patient allongé\n3. Ne laissez pas le patient seul';
    }

    // Badge de confiance
    const confidenceBadge = protocole ?
        (lang === 'ar' ? `\n\n📋 **بروتوكول رسمي — ${protocole.sourceLabel}**` : `\n\n📋 **Protocole officiel — ${protocole.sourceLabel}**`) :
        (lang === 'ar' ? `\n\n⚠️ **تعليمات أمان عامة — لا يوجد بروتوكول رسمي متاح لهذه الحالة**` : `\n\n⚠️ **Instructions de sécurité générales — aucun protocole officiel disponible pour ce cas**`);

    let reply;
    if (isCritique) {
        reply = lang === 'ar' ?
            `🚨🚨 **حالة طارئة جداً — تصرف فوري** 🚨🚨\n\n${firstAidInstructions}\n\n✅ تم إرسال الدوسيه الطبي للفريق المختص.${confidenceBadge}` :
            `🚨🚨 **URGENCE CRITIQUE — ACTION IMMÉDIATE** 🚨🚨\n\n${firstAidInstructions}\n\n✅ Le dossier médical a été transmis à l'équipe spécialisée.${confidenceBadge}`;
    } else {
        reply = lang === 'ar' ?
            `⚠️ **تنبيه طبي — وضع يستدعي التدخل السريع**\n\n${firstAidInstructions}\n\n✅ تم إرسال الدوسيه الطبي للفريق المختص.${confidenceBadge}` :
            `⚠️ **Alerte médicale — Situation nécessitant une intervention rapide**\n\n${firstAidInstructions}\n\n✅ Le dossier médical a été transmis à l'équipe spécialisée.${confidenceBadge}`;
    }

    // Score de confiance
    const confidence = protocole ?
        { level: 'verified', source: protocole.sourceLabel, score: 1.0, label: `✅ Protocole officiel — ${protocole.sourceLabel}` } :
        { level: 'unverified', source: null, score: 0, label: '⚠️ Instructions générales — aucune source officielle disponible' };

    return {
        reply,
        intent: isCritique ? 'critical_emergency' : 'urgent_emergency',
        extractedInfo: summary,
        severity: level,
        escalated: true,
        ragUsed: !!protocole,
        confidence
    };
}

// ================= GÉNÉRATION RÉPONSE MÉDICALE INTELLIGENTE (OPTION C) =================
async function generateSmartResponse(userMessage, ragResults, summary, conversationHistory, emergencyEval, lang, missingFields, userMedicalHistory = null, userAge = null, userGender = null) {
    const historyText = conversationHistory.slice(-8).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Médecin IA'}: ${m.content}`
    ).join('\n');

    // =====================================================
    // OPTION A+B : Construction du contexte RAG + contrainte
    // =====================================================

    // Trouver la meilleure source officielle
    let bestOfficialResult = null;
    let bestMedicalResult = null;

    for (const result of ragResults) {
        if (result.similarity > 0.3 && SOURCE_LABELS[result.source] && !bestOfficialResult) {
            bestOfficialResult = result;
        }
        if (result.similarity > 0.4 && !bestMedicalResult) {
            bestMedicalResult = result;
        }
    }

    const hasOfficialSource = !!bestOfficialResult;
    const hasMedicalContent = !!bestMedicalResult;

    // Construire le contexte RAG injecté dans le prompt
    let ragContext = '';
    if (hasOfficialSource) {
        const sourceLabel = SOURCE_LABELS[bestOfficialResult.source];
        ragContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLE MÉDICAL OFFICIEL — SOURCE VÉRIFIÉE
Source : ${sourceLabel} (similarité: ${Math.round(bestOfficialResult.similarity * 100)}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${bestOfficialResult.content}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    } else if (hasMedicalContent) {
        ragContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFORMATIONS MÉDICALES INTERNES (base médicale non officielle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${bestMedicalResult.content}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    // =====================================================
    // OPTION B : Instruction de contrainte selon disponibilité RAG
    // =====================================================
    let ragConstraint;

    if (hasOfficialSource) {
        ragConstraint = `⛔ RÈGLE ABSOLUE — CONTRAINTE RAG STRICTE :
Tu ne peux utiliser QUE les informations du PROTOCOLE OFFICIEL fourni ci-dessus.
Ne génère aucune instruction médicale qui n'y figure pas explicitement.
Si une question dépasse ce contenu, réponds exactement : "Je ne dispose pas de protocole officiel sur ce point précis — consultez un médecin ou appelez le 141."
Cite OBLIGATOIREMENT la source dans ta réponse : "Selon le protocole ${SOURCE_LABELS[bestOfficialResult.source]}..."`;

    } else if (hasMedicalContent) {
        ragConstraint = `⛔ RÈGLE ABSOLUE — CONTRAINTE RAG STRICTE :
Tu ne peux utiliser QUE les informations médicales fournies dans le contexte ci-dessus.
N'ajoute aucune information médicale supplémentaire qui n'y figure pas.
Si une donnée est absente, indique-le clairement : "Cette information n'est pas disponible dans ma base — consultez un médecin."
Ne cite PAS le nom "base médicale" dans ta réponse.`;

    } else {
        ragConstraint = `⛔ RÈGLE ABSOLUE — AUCUNE SOURCE RAG DISPONIBLE :
Tu NE DOIS PAS générer d'instructions médicales spécifiques de ta propre initiative.
Tu n'as pas de protocole ni de source médicale disponible pour ce cas.
Réponds UNIQUEMENT :
- En posant la question de collecte manquante (si applicable)
- En orientant vers le 141 ou un médecin
- En donnant les 3 mesures de sécurité universelles UNIQUEMENT : ne pas bouger le patient, surveiller la respiration, ne pas donner de médicament sans avis.
NE PAS inventer d'autres étapes. NE PAS diagnostiquer.`;
    }

    // Antécédents médicaux
    let antecedentsInfo = '';
    if (userMedicalHistory) {
        const conditions = [];
        if (userMedicalHistory.diabete) conditions.push('🏥 Diabète');
        if (userMedicalHistory.asthme) conditions.push('🏥 Asthme');
        if (userMedicalHistory.tension) conditions.push('🏥 Hypertension');
        if (userMedicalHistory.other) conditions.push(`🏥 Autre: ${userMedicalHistory.other}`);

        if (conditions.length > 0) {
            antecedentsInfo = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 ANTÉCÉDENTS MÉDICAUX DU PATIENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${conditions.join('\n')}
👤 Âge: ${userAge || 'Non renseigné'} ans
⚥ Sexe: ${userGender === 'homme' ? 'Homme' : userGender === 'femme' ? 'Femme' : 'Non renseigné'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        }
    }

    const collectedInfo = Object.entries(summary)
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

    const nextQuestion = missingFields.length > 0 ? missingFields[0] : null;
    const questionGuide = nextQuestion ?
        `\nTu DOIS poser UNE question naturelle pour obtenir: "${nextQuestion}" — formule-la de façon conversationnelle.` :
        '';

    const prompt = `Tu es un médecin assistant bienveillant, expert et réactif. Tu as une conversation médicale en cours.

HISTORIQUE :
${historyText || "(Premier échange)"}

DERNIER MESSAGE DU PATIENT : "${userMessage}"

INFORMATIONS DÉJÀ COLLECTÉES :
${collectedInfo || "(aucune encore)"}

${antecedentsInfo}
ÉVALUATION MÉDICALE :
- Niveau d'urgence: ${emergencyEval.level || 'non évalué'}
- Analyse: ${emergencyEval.reasoning || ''}
- Action recommandée: ${emergencyEval.recommendedAction || ''}

${ragContext}

${ragConstraint}

CONSIGNES ADDITIONNELLES :
1. Réponds DIRECTEMENT au message du patient avec empathie et professionnalisme
2. ${questionGuide || "Complète avec tes recommandations issues du protocole uniquement."}
3. Tiens compte des ANTÉCÉDENTS MÉDICAUX pour personnaliser les conseils (dans les limites du protocole)
4. Ne répète PAS les infos déjà dites dans l'historique
5. Langue: ${lang === 'ar' ? 'Arabe dialectal marocain compréhensible' : 'Français naturel et clair'}
6. Longueur: max 6 lignes sauf si le protocole en requiert plus
7. Structure ta réponse :
   a) Réponse empathique au message
   b) Instructions issues du protocole (si disponible)
   c) Question de collecte si info manquante
   d) Source citée obligatoirement si protocole officiel

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
async function processMessageGroq(userMessage, currentSummary = {}, sessionId = null, conversationHistory = [], userMedicalHistory = null, userAge = null, userGender = null) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📨 [MESSAGE] "${userMessage}"`);
    console.log(`📊 [RÉSUMÉ ACTUEL]`, JSON.stringify(currentSummary));
    console.log(`${'='.repeat(60)}`);

    if (userMedicalHistory) {
        console.log(`🏥 [ANTÉCÉDENTS] Patient connu:`);
        if (userMedicalHistory.diabete) console.log(`   - Diabète`);
        if (userMedicalHistory.asthme) console.log(`   - Asthme`);
        if (userMedicalHistory.tension) console.log(`   - Hypertension`);
        if (userMedicalHistory.other) console.log(`   - Autre: ${userMedicalHistory.other}`);
        if (userAge) console.log(`   - Âge: ${userAge} ans`);
        if (userGender) console.log(`   - Sexe: ${userGender}`);
    }

    const lang = detectLanguage(userMessage);
    console.log(`🌐 [LANGUE] ${lang}`);

    // ✅ 1. EXTRACTION INTELLIGENTE PAR LLM
    console.log("\n🧠 [EXTRACTION] Analyse sémantique...");
    const extracted = await extractWithGroq(userMessage, currentSummary, conversationHistory, userMedicalHistory, userAge, userGender);

    const updatedSummary = {...currentSummary };
    for (const [key, value] of Object.entries(extracted)) {
        if (value !== null && value !== undefined && value !== '' &&
            !['additionalSymptoms', 'medicalHistory', 'currentMedication', 'emergencyLevel'].includes(key)) {
            updatedSummary[key] = value;
        }
    }
    if (extracted.additionalSymptoms && extracted.additionalSymptoms.length > 0) {
        updatedSummary.additionalSymptoms = extracted.additionalSymptoms;
    }
    if (extracted.medicalHistory) updatedSummary.medicalHistory = extracted.medicalHistory;
    if (extracted.currentMedication) updatedSummary.currentMedication = extracted.currentMedication;
    delete updatedSummary._complete;

    console.log(`📊 [RÉSUMÉ MIS À JOUR]`, JSON.stringify(updatedSummary));

    // ✅ 2. ÉVALUATION URGENCE PAR LLM
    console.log("\n⚠️ [URGENCE] Évaluation intelligente...");
    const emergencyEval = await evaluateEmergencyByLLM(userMessage, updatedSummary, conversationHistory, userMedicalHistory, userAge);

    // ✅ 3. CAS CRITIQUE OU URGENT → GESTION UNIFIÉE
    if (emergencyEval.needsImmediateAction &&
        (emergencyEval.level === 'critique' || emergencyEval.level === 'urgent')) {

        if (updatedSummary.symptom) {
            console.log(`🚨 [${emergencyEval.level.toUpperCase()}] Action immédiate déclenchée`);
            return await handleHighEmergency(
                userMessage, updatedSummary, sessionId, lang,
                emergencyEval.level, emergencyEval.reasoning
            );
        }

        // Infos insuffisantes → collecter en urgence avec mesures de sécurité universelles uniquement
        const urgentCollect = lang === 'ar' ?
            `⚠️ **وضع يستدعي الانتباه — ${emergencyEval.reasoning}**\n\n🩺 في انتظار المزيد من المعلومات، إليك الإجراءات الآمنة الأساسية :\n1. أبقِ المريض في وضع مريح\n2. لا تعطه أي دواء دون استشارة\n3. راقب التنفس\n\nما هو العرض الرئيسي الذي يعاني منه المريض؟` :
            `⚠️ **Situation préoccupante — ${emergencyEval.reasoning}**\n\n🩺 En attendant plus d'informations, mesures de sécurité de base :\n1. Allongez le patient dans une position confortable\n2. Ne donnez aucun médicament sans avis médical\n3. Surveillez la respiration\n\nQuel est le symptôme principal du patient ?`;

        return {
            reply: urgentCollect,
            extractedInfo: extracted,
            intent: "urgent_collect",
            severity: emergencyEval.level,
            updatedSummary,
            confidence: { level: 'unverified', source: null, score: 0, label: '⚠️ Mesures générales — informations insuffisantes' }
        };
    }

    // ✅ 4. RECHERCHE RAG
    console.log("\n🔍 [RAG] Recherche...");
    const searchQuery = updatedSummary.symptom ?
        `${updatedSummary.symptom} ${updatedSummary.bodyPart || ''} ${userMessage}`.trim() :
        userMessage;
    const ragResults = await searchRAG(searchQuery, lang);

    // ✅ 5. CALCUL CONFIANCE
    const confidence = computeConfidence(ragResults);
    console.log(`🔒 [CONFIANCE] ${confidence.label}`);

    // ✅ 6. CHAMPS MANQUANTS
    const missing = getMissing(updatedSummary);
    console.log(`📋 [MANQUANTS] ${missing.length > 0 ? missing.join(', ') : 'Aucun'}`);

    // ✅ 7. GÉNÉRATION RÉPONSE INTELLIGENTE CONTRAINTE (OPTION C)
    console.log("\n💬 [GROQ] Génération réponse contrainte...");
    const medicalResponse = await generateSmartResponse(
        userMessage, ragResults, updatedSummary, conversationHistory,
        emergencyEval, lang, missing, userMedicalHistory, userAge, userGender
    );

    // ✅ 8. COLLECTE COMPLÈTE → ENVOYER AU PFA
    if (missing.length === 0) {
        console.log(`✅ [COMPLET] Toutes les infos collectées — envoi au PFA`);
        await sendToPFA(updatedSummary, sessionId);

        const severity = evaluateSeverity(updatedSummary, userMedicalHistory);
        const completionPrefix = lang === 'ar' ?
            `✅ **تم جمع المعلومات الكاملة — الدوسيه أُرسل للفريق الطبي**\n\n` :
            `✅ **Dossier complet — transmis à l'équipe médicale**\n\n`;

        return {
            reply: completionPrefix + medicalResponse,
            extractedInfo: extracted,
            intent: "complete",
            severity,
            esoSummary: updatedSummary,
            updatedSummary: {...updatedSummary, _complete: true },
            ragUsed: ragResults.length > 0,
            confidence
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
        missingFields: missing,
        confidence
    };
}

// Garder escaladeUrgence pour compatibilité avec les autres routes
async function escaladeUrgence(summary, sessionId, reasoning, lang = 'fr') {
    return await handleHighEmergency(null, summary, sessionId, lang, 'urgent', reasoning);
}

module.exports = { processMessageGroq, escaladeUrgence, handleHighEmergency };