const { callGroq, callGroqSafe } = require('./groqService');
const { evaluateSeverity } = require('./nlpService');
const { getRAGResponse } = require('./ragService');
const { calculateRAGConfidence } = require('./confidenceService');
const { sendHumanAlert } = require('./hilService');
const axios = require('axios');
require('dotenv').config();
// ================= ADAPTATEURS =================

async function searchRAG(query, lang) {
    try {
        const result = await getRAGResponse(query);
        if (!result || !result.matched) return [];
        return [{
            content: result.reply,
            source: result.source || 'MinSante_Maroc',
            similarity: result.confidence || 0.5
        }];
    } catch (e) {
        console.error('❌ [searchRAG]', e.message);
        return [];
    }
}

async function getProtocoleFromRAG(summary, lang) {
    try {
        const query = `${summary.symptom || ''} ${summary.bodyPart || ''}`.trim();
        if (!query) return null;
        const result = await getRAGResponse(query);
        if (!result || !result.matched || result.confidence < 0.3) return null;
        return {
            content: result.reply,
            sourceLabel: SOURCE_LABELS[result.source] || 'Protocole médical',
            confidence: result.confidence
        };
    } catch (e) {
        console.error('❌ [getProtocoleFromRAG]', e.message);
        return null;
    }
}

function computeConfidence(ragResults) {
    if (!ragResults || ragResults.length === 0)
        return { level: 'unverified', source: null, score: 0, label: '⚠️ Aucune source disponible' };
    const best = ragResults[0];
    const score = best.similarity || 0;
    if (score >= 0.7)
        return { level: 'verified', source: best.source, score, label: `✅ Source fiable (${Math.round(score * 100)}%)` };
    if (score >= 0.4)
        return { level: 'partial', source: best.source, score, label: `⚠️ Source partielle (${Math.round(score * 100)}%)` };
    return { level: 'unverified', source: null, score, label: '⚠️ Confiance faible' };
}

async function sendEmergencySMS(summary, sessionId, reason) {
    try {
        await sendHumanAlert(summary, sessionId, reason, 1.0);
    } catch (e) {
        console.error('❌ [sendEmergencySMS]', e.message);
    }
}

async function sendToPFA(summary, sessionId) {
    const PFA_URL = process.env.PFA_URL || process.env.SGUM_URL;
    if (!PFA_URL) {
        console.warn('⚠️ [PFA] PFA_URL non définie — dossier non envoyé');
        return false;
    }
    try {
        await axios.post(PFA_URL, {
            sessionId,
            timestamp: new Date().toISOString(),
            ...summary
        }, { timeout: 5000 });
        console.log('✅ [PFA] Dossier envoyé');
        return true;
    } catch (e) {
        console.error('❌ [PFA] Échec envoi:', e.message);
        return false;
    }
}

// ================= CONFIGURATION =================
const D7_API_KEY = process.env.D7_API_KEY;
const EMERGENCY_PHONE = process.env.EMERGENCY_PHONE || "+212602641467";

const REQUIRED_FIELDS = ["symptom", "bodyPart", "duration", "age", "patientLocation"];

const FIELD_QUESTIONS_FR = {
    symptom: "Quel est le symptôme principal que vous ressentez ?",
    bodyPart: "Quelle partie du corps est concernée ?",
    duration: "Depuis combien de temps durent ces symptômes ?",
    age: "Quel est l'âge du patient ?",
    patientLocation: "Où se trouve le patient en ce moment (ville, quartier, adresse) ?"
};

const FIELD_QUESTIONS_AR = {
    symptom: "شنو هو العرض الرئيسي اللي كتحس بيه؟",
    bodyPart: "فين كا توجعك بالضبط؟",
    duration: "من فوقاش كا تحس بهاد الشي؟",
    age: "شحال عمرك",
    patientLocation: "فين كاين دابا (المدينة أو الحي)؟"
};

function getMissing(summary) {
    return REQUIRED_FIELDS.filter(f => !summary[f]);
}

function isFieldAlreadyAskedIn(response, field, lang) {
    return false;
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

// ================= CONVERSION NOMBRES ARABES EN CHIFFRES =================
function convertArabicNumberToInt(text) {
    if (!text) return null;

    // Chiffres arabes-indiens → latins
    const arabicIndic = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    let normalized = text.replace(/[٠-٩]/g, d => arabicIndic[d]);

    // Nombre déjà en chiffres
    const directMatch = normalized.match(/\b(\d{1,3})\b/);
    if (directMatch) {
        const n = parseInt(directMatch[1]);
        if (n >= 1 && n <= 120) return n;
    }

    // Nombres écrits en lettres arabe/darija
    const wordMap = {
        // unités
        'واحد': 1,
        'وحد': 1,
        'اثنين': 2,
        'جوج': 2,
        'ثلاثة': 3,
        'تلاتة': 3,
        'تلاثة': 3,
        'أربعة': 4,
        'ربعة': 4,
        'رابعة': 4,
        'خمسة': 5,
        'خمسا': 5,
        'ستة': 6,
        'ستا': 6,
        'سبعة': 7,
        'سبعا': 7,
        'ثمانية': 8,
        'تمانية': 8,
        'تمنية': 8,
        'تسعة': 9,
        'تسعا': 9,
        'عشرة': 10,
        'عشرا': 10,
        // dizaines
        'عشرين': 20,
        'عشرون': 20,
        'واحد وعشرين': 21,
        'اثنين وعشرين': 22,
        'ثلاثين': 30,
        'تلاتين': 30,
        'أربعين': 40,
        'ربعين': 40,
        'خمسين': 50,
        'ستين': 60,
        'سبعين': 70,
        'ثمانين': 80,
        'تمانين': 80,
        'تسعين': 90,
        // combinaisons fréquentes
        'واحد وثلاثين': 31,
        'اثنين وثلاثين': 32,
        'ثلاثة وثلاثين': 33,
        'واحد وأربعين': 41,
        'اثنين وأربعين': 42,
        'خمسة وأربعين': 45,
        'واحد وخمسين': 51,
        'خمسة وخمسين': 55,
        'واحد وستين': 61,
        'خمسة وستين': 65,
        'واحد وسبعين': 71,
        'خمسة وسبعين': 75,
        'واحد وثمانين': 81,
        'خمسة وثمانين': 85,
        'واحد وتسعين': 91,
        'خمسة وتسعين': 95,
    };

    const t = text.trim().replace(/\s+/g, ' ');
    for (const [word, val] of Object.entries(wordMap)) {
        if (t.includes(word)) return val;
    }

    return null;
}

// ================= DÉTECTION EXPLICITE DE L'ÂGE =================
function ageExplicitlyMentionedInMessage(message) {
    // Patterns français
    const frPatterns = [
        /\bil\s+a\s+\d+/i, /\belle\s+a\s+\d+/i, /\bj['']ai\s+\d+/i,
        /\b\d+\s*(ans?|an)\b/i, /\bâge\s*[:=]\s*\d+/i, /\bagé\s+de\s+\d+/i,
        /\bpatient\s+de\s+\d+/i, /\benfant\s+de\s+\d+/i, /\bfils\s+de\s+\d+/i,
        /\bfille\s+de\s+\d+/i, /\bmon\s+fils\s+.*?\d+/i, /\bma\s+fille\s+.*?\d+/i,
        /\bma\s+mère\s+.*?\d+/i, /\bmon\s+père\s+.*?\d+/i,
        /^\s*\d{1,3}\s*$/,
    ];

    // Patterns arabes (chiffres)
    const arPatterns = [
        /عندو\s+\d+/i, /عندها\s+\d+/i, /عندي\s+\d+/i,
        /عمره\s+\d+/i, /عمرها\s+\d+/i, /عمري\s+\d+/i,
        /\d+\s*(عام|سنة|سنين)/i, /عمر.*?\d+/i,
        /^\s*\d{1,3}\s*$/,
    ];

    // Patterns arabes (nombres en lettres)
    const arWordsPatterns = [
        /عندي\s+(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)/i,
        /عمري\s+(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)/i,
        /عندو\s+(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)/i,
        /(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)\s*(عام|سنة|سنين)/i,
        // message court = réponse directe à "quel âge"
        /^[\u0600-\u06FF\s]{3,20}$/,
    ];

    for (const p of frPatterns) { if (p.test(message)) { console.log(`✅ [AGE FR] ${p}`); return true; } }
    for (const p of arPatterns) { if (p.test(message)) { console.log(`✅ [AGE AR] ${p}`); return true; } }
    for (const p of arWordsPatterns) { if (p.test(message)) { console.log(`✅ [AGE AR LETTRES] ${p}`); return true; } }

    console.log(`⛔ [AGE] Pas de mention explicite: "${message}"`);
    return false;
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
ANTÉCÉDENTS MÉDICAUX CONNUS (profil) — NE PAS utiliser pour remplir le champ "age" :
- Sexe: ${userGender === 'homme' ? 'Homme' : userGender === 'femme' ? 'Femme' : 'Non renseigné'}
- Antécédents: ${conditions.join(', ')}
⚠️ L'âge doit venir UNIQUEMENT du message ci-dessous.
`;
        }
    }

    const alreadyCollected = Object.entries(currentSummary)
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k, v]) => `  "${k}": "${v}"`)
        .join('\n');

    const prompt = `Tu es un agent d'extraction médicale expert en arabe dialectal marocain (darija), arabe standard et français.

HISTORIQUE :
${historyText || "(Début de conversation)"}

${antecedentsSection}
MESSAGE DU PATIENT : "${message}"

DONNÉES DÉJÀ COLLECTÉES (NE PAS ÉCRASER) :
${alreadyCollected || "(aucune encore)"}

═══════════════════════════════════════════════════
RÈGLES D'EXTRACTION
═══════════════════════════════════════════════════

▸ ÂGE — CRITIQUE : convertir les nombres en lettres arabes/darija en entier :
  - "عشرين" → 20, "عشرين عام" → 20
  - "ثلاثين" → 30, "أربعين" / "ربعين" → 40
  - "خمسين" → 50, "ستين" → 60, "سبعين" → 70
  - "ثمانين" / "تمانين" → 80, "تسعين" → 90
  - "واحد وعشرين" → 21, "خمسة وثلاثين" → 35
  - "20", "44", "عندي 20", "عمري 20", "عندو 20" → extraire le nombre
  - Le mot "عام" / "سنة" / "ans" est OPTIONNEL
  - Si l'assistant vient de demander l'âge et le patient répond un mot ou nombre → age = ce nombre converti

▸ DURÉE — normaliser en français :
  - "البارح" / "امبارح" / "barhar" → "depuis hier"
  - "من الصباح" / "من الصبح" → "depuis ce matin"
  - "ثلاث ساعات" / "3 ساعات" → "depuis 3 heures"
  - "يومين" → "depuis 2 jours", "أسبوع" / "جمعة" → "depuis une semaine"
  - "من شهر" → "depuis un mois"

▸ INTENSITÉ — UNIQUEMENT un entier de 1 à 10 ou null :
  - "بزاف" / "كثير" → 7
  - "شوية" / "قليلا" → 3
  - JAMAIS un mot comme "urgent", "critique", "modere" → null

▸ SYMPTÔME (darija → français) :
  - "كيدور راسي" / "راسي كا يدور" → "vertige / maux de tête"
  - "عندي سخانة" → "fièvre"
  - "ما كنبدش نتنفس" → "difficulté à respirer"
  - "qlbi kaydrb" → "palpitations"
  - "للا" / "لا" en réponse à "fièvre ?" → ne pas mettre comme symptôme

▸ PARTIE DU CORPS :
  - "راسي" / "rassi" → "tête"
  - "ضهر" / "dhar" → "dos"
  - "ركبة" → "genou", "بطن" / "كرش" → "abdomen"

▸ LOCALISATION :
  - "وجدة" → "Oujda", "Casa" → "Casablanca", "Rbat" → "Rabat"

▸ RÈGLES GÉNÉRALES :
  - Si le patient dit "لا" / "للا" en réponse à une question → ignorer pour les champs, ne pas écraser
  - NE PAS écraser un champ existant par null
  - Si l'assistant a posé une question précise et le patient répond → extraire dans ce champ

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après :
{
  "symptom": "symptôme en français ou null",
  "bodyPart": "partie du corps en français ou null",
  "duration": "durée normalisée en français ou null",
  "age": nombre entier ou null,
  "patientLocation": "ville/adresse ou null",
  "intensity": nombre entier 1-10 ou null,
  "additionalSymptoms": [],
  "medicalHistory": "antécédents ou null",
  "currentMedication": "médicaments ou null",
  "emergencyLevel": "critique|urgent|modere|faible"
}`;

    try {
        const response = await callGroq(prompt);
        if (!response) {
            console.warn("⚠️ [EXTRACTION] Tous les modèles Groq épuisés");
            return {};
        }
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // ── Sanitisation age ─────────────────────────────────────
            // Si LLM retourne null mais message contient un nombre en lettres → convertir
            if ((parsed.age === null || parsed.age === undefined)) {
                const converted = convertArabicNumberToInt(message);
                if (converted && ageExplicitlyMentionedInMessage(message)) {
                    parsed.age = converted;
                    console.log(`✅ [AGE CONVERTI LETTRES] "${message}" → ${converted}`);
                }
            }

            // ── Sanitisation intensity ───────────────────────────────
            if (parsed.intensity !== null && parsed.intensity !== undefined) {
                const n = Number(parsed.intensity);
                if (isNaN(n) || n < 1 || n > 10) {
                    console.warn(`⚠️ [SANITIZE intensity] "${parsed.intensity}" rejeté`);
                    parsed.intensity = null;
                } else {
                    parsed.intensity = n;
                }
            }

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
            antecedentsInfo = `\nANTÉCÉDENTS : ${conditions.join(', ')}. Âge profil: ${userAge || 'non renseigné'} ans.`;
        }
    }

    const prompt = `Tu es un médecin urgentiste expérimenté. Évalue la gravité.

CONTEXTE :
${historyText || "(Premier message)"}

MESSAGE : "${userMessage}"

INFORMATIONS :
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

- critique: danger de mort immédiat
- urgent: consultation dans les heures qui suivent
- modere: consultation dans la journée
- faible: conseil médical suffit`;

    try {
        const response = await callGroq(prompt);
        if (!response) {
            console.warn("⚠️ [URGENCE] Fallback modere");
            return { level: 'modere', needsImmediateAction: false, recommendedAction: 'conseil médical' };
        }
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log(`⚠️ [URGENCE LLM] Niveau: ${result.level} | ${result.reasoning}`);
            return result;
        }
        return { level: 'modere', needsImmediateAction: false, recommendedAction: 'conseil médical' };
    } catch (e) {
        console.error("❌ Erreur urgence:", e.message);
        return { level: 'modere', needsImmediateAction: false };
    }
}

// ================= GESTION URGENCE =================
async function handleHighEmergency(userMessage, summary, sessionId, lang, level, reasoning) {
    const isCritique = level === 'critique';
    console.log(`${isCritique ? '🔴🔴🔴 URGENCE CRITIQUE' : '🟠 URGENCE STANDARD'} — ${reasoning}`);

    await sendEmergencySMS(summary, sessionId, `${level.toUpperCase()} - ${reasoning}`);
    await sendToPFA(summary, sessionId);
    console.log(`✅ Dossier envoyé au PFA (niveau: ${level})`);

    const protocole = await getProtocoleFromRAG(summary, lang);

    let firstAidPrompt;
    if (protocole) {
        firstAidPrompt = `Tu es un médecin urgentiste. Instructions de premiers secours depuis ce protocole officiel (${protocole.sourceLabel}) :
${protocole.content}

Symptôme: ${summary.symptom || 'non précisé'}, Âge: ${summary.age || 'non précisé'}
Langue: ${lang === 'ar' ? 'darija marocain UNIQUEMENT — sans mélange français' : 'français direct'}
Format: liste numérotée, max 5 étapes. ${isCritique ? 'Commence par appeler le 141.' : ''}
Réponds UNIQUEMENT avec les instructions, sans introduction ni salutation.`;
    } else {
        firstAidPrompt = `Tu es un médecin urgentiste.
Donne ces 5 mesures en ${lang === 'ar' ? 'darija marocain UNIQUEMENT — sans mélange français — sans salutation' : 'français direct'} :
1. ${lang === 'ar' ? 'اتصل بالإسعاف على الرقم 141' : 'Appelez le 141'}
2. ${lang === 'ar' ? 'خلي المريض يستريح فوضعة مريحة' : 'Allongez le patient confortablement'}
3. ${lang === 'ar' ? 'ما تعطيوش أي دواء بلا رأي الطبيب' : 'Ne donnez aucun médicament sans avis médical'}
4. ${lang === 'ar' ? 'راقب التنفس ومستوى الوعي' : 'Surveillez la respiration et la conscience'}
5. ${lang === 'ar' ? 'متخليوش المريض وحدو حتى يوصل الإسعاف' : 'Ne laissez pas le patient seul'}
Réponds UNIQUEMENT avec ces 5 instructions numérotées, sans introduction.`;
    }

    let firstAidInstructions = '';
    try {
        const _aid = await callGroq(firstAidPrompt);
        firstAidInstructions = _aid ? _aid.trim() : '';
    } catch (e) {
        firstAidInstructions = lang === 'ar' ?
            '1. اتصل بـ 141\n2. خلي المريض يستريح\n3. متخليوش وحدو' :
            '1. Appelez le 141\n2. Allongez le patient\n3. Ne laissez pas seul';
    }


    const reply = isCritique ?
        (lang === 'ar' ?
            `🚨🚨 **حالة طارئة — تصرف فوري** 🚨🚨\n\n${firstAidInstructions}\n\n✅ تم إرسال الدوسيه للفريق المختص.` :
            `🚨🚨 **URGENCE CRITIQUE — ACTION IMMÉDIATE** 🚨🚨\n\n${firstAidInstructions}\n\n✅ Le dossier a été transmis.`) :
        (lang === 'ar' ?
            `⚠️ **تنبيه طبي — الوضع يحتاج تدخل سريع**\n\n${firstAidInstructions}\n\n✅ تم إرسال الدوسيه للفريق المختص.` :
            `⚠️ **Alerte médicale**\n\n${firstAidInstructions}\n\n✅ Le dossier a été transmis.`);

    const confidence = protocole ? { level: 'verified', source: protocole.sourceLabel, score: 1.0, label: `✅ Protocole officiel — ${protocole.sourceLabel}` } : { level: 'unverified', source: null, score: 0, label: '⚠️ Instructions générales' };

    const missingAfterEmergency = REQUIRED_FIELDS.filter(f => !summary[f]);
    let finalReply = reply;

    if (missingAfterEmergency.length > 0) {
        const pendingQuestions = missingAfterEmergency.map(field =>
            lang === 'ar' ? FIELD_QUESTIONS_AR[field] : FIELD_QUESTIONS_FR[field]
        );
        const separator = lang === 'ar' ?
            '\n\n─────────────────────────\n⚠️ **معلومات ضرورية للإسعاف:**\n' :
            '\n\n─────────────────────────\n⚠️ **Informations nécessaires :**\n';
        const questionsBlock = pendingQuestions.map((q, i) => `📋 ${i + 1}. ${q}`).join('\n');
        finalReply = reply + separator + questionsBlock;
        console.log(`📋 [URGENCE + COLLECTE] Manquants: ${missingAfterEmergency.join(', ')}`);
    }

    return {
        reply: finalReply,
        intent: isCritique ? 'critical_emergency' : 'urgent_emergency',
        extractedInfo: summary,
        severity: level,
        escalated: true,
        ragUsed: !!protocole,
        confidence,
        missingFields: missingAfterEmergency,
        updatedSummary: summary
    };
}

// ================= GÉNÉRATION RÉPONSE MÉDICALE =================
async function generateSmartResponse(userMessage, ragResults, summary, conversationHistory, emergencyEval, lang, missingFields, userMedicalHistory = null, userAge = null, userGender = null) {
    const historyText = conversationHistory.slice(-8).map(m =>
        `${m.role === 'user' ? 'Patient' : 'Agent'}: ${m.content}`
    ).join('\n');

    let bestOfficialResult = null;
    let bestMedicalResult = null;
    for (const result of ragResults) {
        if (result.similarity > 0.3 && SOURCE_LABELS[result.source] && !bestOfficialResult) bestOfficialResult = result;
        if (result.similarity > 0.4 && !bestMedicalResult) bestMedicalResult = result;
    }

    const hasOfficialSource = !!bestOfficialResult;
    const hasMedicalContent = !!bestMedicalResult;

    let ragContext = '';
    if (hasOfficialSource) {
        ragContext = `PROTOCOLE OFFICIEL (${SOURCE_LABELS[bestOfficialResult.source]}) :\n${bestOfficialResult.content}`;
    } else if (hasMedicalContent) {
        ragContext = `INFORMATIONS MÉDICALES :\n${bestMedicalResult.content}`;
    }

    let ragConstraint;
    if (hasOfficialSource) {
        ragConstraint = `⛔ Utilise UNIQUEMENT le protocole officiel fourni. Cite la source.`;
    } else if (hasMedicalContent) {
        ragConstraint = `⛔ Utilise UNIQUEMENT les informations médicales fournies.`;
    } else {
        ragConstraint = `⛔ Aucune source RAG — ne génère PAS d'instructions médicales. Pose uniquement la question manquante.`;
    }

    let antecedentsInfo = '';
    if (userMedicalHistory) {
        const conditions = [];
        if (userMedicalHistory.diabete) conditions.push('Diabète');
        if (userMedicalHistory.asthme) conditions.push('Asthme');
        if (userMedicalHistory.tension) conditions.push('Hypertension');
        if (conditions.length > 0) {
            antecedentsInfo = `\nANTÉCÉDENTS : ${conditions.join(', ')} | Âge profil: ${userAge || '?'} | Sexe: ${userGender || '?'}`;
        }
    }

    const collectedInfo = Object.entries(summary)
        .filter(([k, v]) => v && !k.startsWith('_'))
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

    const collectionInstruction = missingFields.length > 0 ?
        `⛔ NE pose PAS de question. Accuse réception en 1 ligne. La question sera ajoutée automatiquement.` : '';

    const langInstruction = lang === 'ar' ?
        `LANGUE : Réponds en darija marocain UNIQUEMENT. Zéro mélange français. Pas de salutation.` :
        `LANGUE : Français direct. Pas de salutation.`;

    const prompt = `Tu es un agent médical d'urgence. Tu comprends le darija marocain, l'arabe et le français.

${langInstruction}

RÈGLES :
- Réponses très courtes (max 2-3 lignes hors instructions)
- Une seule question à la fois
- Pas de bavardage ni d'introduction
- Si "لا" ou "للا" = réponse négative → ne pas stocker comme symptôme

HISTORIQUE :
${historyText || "(début)"}

MESSAGE : "${userMessage}"

COLLECTÉ :
${collectedInfo || "(rien)"}${antecedentsInfo}

${ragContext}
${ragConstraint}
${collectionInstruction}

RÉPONSE :`;

    try {
        const response = await callGroq(prompt);
        if (!response) {
            return lang === 'ar' ?
                'عذراً، الخدمة مشغولة. عاود المحاولة.' :
                "Service momentanément indisponible. Réessayez.";
        }
        return response.trim();
    } catch (error) {
        return lang === 'ar' ?
            "عذراً، ما قدرتش نعالج طلبك. عاود المحاولة." :
            "Désolé, erreur de traitement. Réessayez.";
    }
}

// ================= PROCESSUS PRINCIPAL =================
async function processMessageGroq(
    userMessage,
    currentSummary = {},
    sessionId = null,
    conversationHistory = [],
    userMedicalHistory = null,
    userAge = null,
    userGender = null
) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📨 [MESSAGE] "${userMessage}"`);
    console.log(`📊 [RÉSUMÉ ACTUEL]`, JSON.stringify(currentSummary));
    console.log(`${'='.repeat(60)}`);

    if (userMedicalHistory) {
        if (userMedicalHistory.diabete) console.log(`   - Diabète`);
        if (userMedicalHistory.asthme) console.log(`   - Asthme`);
        if (userMedicalHistory.tension) console.log(`   - Hypertension`);
        if (userAge) console.log(`   - Âge profil: ${userAge}`);
        if (userGender) console.log(`   - Sexe: ${userGender}`);
    }

    const lang = detectLanguage(userMessage);
    console.log(`🌐 [LANGUE] ${lang}`);

    // ✅ 1. EXTRACTION LLM
    console.log("\n🧠 [EXTRACTION] Analyse sémantique...");
    const extracted = await extractWithGroq(userMessage, currentSummary, conversationHistory, userMedicalHistory, userAge, userGender);

    // ✅ 2. FUSION
    const updatedSummary = {...currentSummary };
    const specialFields = ['additionalSymptoms', 'medicalHistory', 'currentMedication', 'emergencyLevel', 'age', 'intensity'];

    for (const [key, value] of Object.entries(extracted)) {
        if (specialFields.includes(key)) continue;
        if (value !== null && value !== undefined && value !== '') {
            updatedSummary[key] = value;
            console.log(`✅ [FUSION] ${key} = ${JSON.stringify(value)}`);
        } else {
            console.log(`⚠️ [FUSION IGNORÉE] ${key} → null`);
        }
    }

    if (extracted.additionalSymptoms && extracted.additionalSymptoms.length > 0) updatedSummary.additionalSymptoms = extracted.additionalSymptoms;
    if (extracted.medicalHistory) updatedSummary.medicalHistory = extracted.medicalHistory;
    if (extracted.currentMedication) updatedSummary.currentMedication = extracted.currentMedication;

    // Intensity
    if (extracted.intensity !== null && extracted.intensity !== undefined) {
        const n = Number(extracted.intensity);
        if (!isNaN(n) && n >= 1 && n <= 10) {
            updatedSummary.intensity = n;
            console.log(`✅ [FUSION] intensity = ${n}`);
        }
    }

    // ── AGE — logique stricte avec conversion nombres arabes ──────
    if (currentSummary.age) {
        updatedSummary.age = currentSummary.age;
        console.log(`✅ [AGE CONSERVÉ] ${currentSummary.age}`);
    } else if (extracted.age !== null && extracted.age !== undefined && ageExplicitlyMentionedInMessage(userMessage)) {
        updatedSummary.age = extracted.age;
        console.log(`✅ [AGE ACCEPTÉ LLM] ${extracted.age}`);
    } else {
        // Fallback : conversion programmatique si LLM a échoué
        const converted = convertArabicNumberToInt(userMessage);
        if (converted && ageExplicitlyMentionedInMessage(userMessage)) {
            updatedSummary.age = converted;
            console.log(`✅ [AGE CONVERTI FALLBACK] "${userMessage}" → ${converted}`);
        } else {
            console.log(`⚠️ [AGE] Non extrait — question sera posée`);
        }
    }

    delete updatedSummary._complete;
    console.log(`📊 [RÉSUMÉ MIS À JOUR]`, JSON.stringify(updatedSummary));

    // ✅ 3. ÉVALUATION URGENCE
    console.log("\n⚠️ [URGENCE] Évaluation...");
    const emergencyEval = await evaluateEmergencyByLLM(userMessage, updatedSummary, conversationHistory, userMedicalHistory, userAge);

    // ✅ 4. CAS CRITIQUE / URGENT
    if (emergencyEval.needsImmediateAction &&
        (emergencyEval.level === 'critique' || emergencyEval.level === 'urgent')) {

        if (updatedSummary.symptom) {
            console.log(`🚨 [${emergencyEval.level.toUpperCase()}] Déclenchement`);
            return await handleHighEmergency(userMessage, updatedSummary, sessionId, lang, emergencyEval.level, emergencyEval.reasoning);
        }

        const urgentCollect = lang === 'ar' ?
            `⚠️ **الوضع خطير**\n\n1. خلي المريض يستريح\n2. ما تعطيوش دواء\n3. راقب التنفس\n\nشنو هو العرض الرئيسي؟` :
            `⚠️ **Situation préoccupante**\n\n1. Allongez le patient\n2. Pas de médicament\n3. Surveillez la respiration\n\nQuel est le symptôme principal ?`;

        return {
            reply: urgentCollect,
            extractedInfo: extracted,
            intent: "urgent_collect",
            severity: emergencyEval.level,
            updatedSummary,
            confidence: { level: 'unverified', source: null, score: 0, label: '⚠️ Infos insuffisantes' }
        };
    }

    // ✅ 5. RECHERCHE RAG
    console.log("\n🔍 [RAG] Recherche...");
    const searchQuery = updatedSummary.symptom ?
        `${updatedSummary.symptom} ${updatedSummary.bodyPart || ''} ${userMessage}`.trim() : userMessage;
    const ragResults = await searchRAG(searchQuery, lang);

    // ✅ 6. CONFIANCE
    const confidence = computeConfidence(ragResults);
    console.log(`🔒 [CONFIANCE] ${confidence.label}`);

    // ✅ 7. CHAMPS MANQUANTS
    const missing = getMissing(updatedSummary);
    console.log(`📋 [MANQUANTS] ${missing.length > 0 ? missing.join(', ') : 'Aucun ✅'}`);

    // ✅ 8. GÉNÉRATION RÉPONSE
    console.log("\n💬 [GROQ] Génération réponse...");
    const medicalResponse = await generateSmartResponse(
        userMessage, ragResults, updatedSummary, conversationHistory,
        emergencyEval, lang, missing, userMedicalHistory, userAge, userGender
    );

    // ✅ GARANTIE QUESTION CHAMP MANQUANT
    let finalReply = medicalResponse;
    if (missing.length > 0) {
        const nextField = missing[0];
        const fieldQuestion = lang === 'ar' ? FIELD_QUESTIONS_AR[nextField] : FIELD_QUESTIONS_FR[nextField];
        if (!isFieldAlreadyAskedIn(medicalResponse, nextField, lang)) {
            finalReply = medicalResponse.trimEnd() + `\n\n📋 **${fieldQuestion}**`;
            console.log(`📌 [FORCE QUESTION] "${nextField}"`);
        }
    }

    // ✅ 9. COLLECTE COMPLÈTE
    if (missing.length === 0 && !currentSummary._complete) {
        console.log(`✅ [COMPLET] Envoi au PFA`);
        await sendToPFA(updatedSummary, sessionId);

        const severity = evaluateSeverity(updatedSummary, userMedicalHistory);
        const protocole = await getProtocoleFromRAG(updatedSummary, lang);

        let instructionsPrompt;
        if (protocole) {
            instructionsPrompt = `Instructions de premiers secours depuis ce protocole (${protocole.sourceLabel}) :
${protocole.content}
Symptôme: ${updatedSummary.symptom}, Partie: ${updatedSummary.bodyPart}, Âge: ${updatedSummary.age}
Langue: ${lang === 'ar' ? 'darija marocain UNIQUEMENT — sans mélange français' : 'français'}
Format: liste numérotée, max 5 étapes, sans introduction.`;
        } else {
            instructionsPrompt = `Instructions de sécurité universelles.
Symptôme: ${updatedSummary.symptom}, Âge: ${updatedSummary.age}
Langue: ${lang === 'ar' ? 'darija marocain UNIQUEMENT — sans mélange français' : 'français'}
3 étapes max : surveiller, hydrater si possible, consulter si aggravation.`;
        }

        let instructions = '';
        try {
            const _inst = await callGroq(instructionsPrompt);
            instructions = _inst ? _inst.trim() : '';
        } catch (e) {
            instructions = lang === 'ar' ? 'راقب المريض واستشر طبيباً.' : 'Surveillez et consultez un médecin.';
        }

        const sourceBadge = protocole ?
            (lang === 'ar' ? `\n\n📋 **بروتوكول رسمي — ${protocole.sourceLabel}**` : `\n\n📋 **Protocole officiel — ${protocole.sourceLabel}**`) : '';

        const completionMsg = lang === 'ar' ?
            `✅ **تم جمع المعلومات — الدوسيه أُرسل للفريق الطبي**\n\n${instructions}${sourceBadge}` :
            `✅ **Dossier complet — transmis à l'équipe médicale**\n\n${instructions}${sourceBadge}`;

        return {
            reply: completionMsg,
            extractedInfo: extracted,
            intent: "complete",
            severity,
            esoSummary: updatedSummary,
            updatedSummary: {...updatedSummary, _complete: true },
            ragUsed: !!protocole,
            confidence
        };
    }

    if (missing.length === 0 && currentSummary._complete) {
        const alreadyDoneMsg = lang === 'ar' ?
            'تم إرسال الدوسيه بالفعل. إذا كانت الحالة تتفاقم، اتصل بـ 141.' :
            "Le dossier a déjà été transmis. En cas d'aggravation, appelez le 141.";
        return {
            reply: alreadyDoneMsg,
            extractedInfo: extracted,
            intent: "complete",
            severity: evaluateSeverity(updatedSummary, userMedicalHistory),
            esoSummary: updatedSummary,
            updatedSummary,
            ragUsed: false,
            confidence
        };
    }

    // ✅ 10. CONTINUER LA COLLECTE
    return {
        reply: finalReply,
        extractedInfo: extracted,
        intent: "collect",
        severity: emergencyEval.level,
        updatedSummary,
        ragUsed: ragResults.length > 0,
        missingFields: missing,
        confidence
    };
}

async function escaladeUrgence(summary, sessionId, reasoning, lang = 'fr') {
    return await handleHighEmergency(null, summary, sessionId, lang, 'urgent', reasoning);
}

module.exports = { processMessageGroq, escaladeUrgence, handleHighEmergency };