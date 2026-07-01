const { callGroq, callGroqSafe } = require('./groqService');
const { evaluateSeverity } = require('./nlpService');
const { getRAGResponse } = require('./ragService');
const { calculateChatConfidence } = require('./confidenceService');
const { sendHumanAlert } = require('./hilService');
const axios = require('axios');
require('dotenv').config();

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.60');

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
        if (!result || !result.matched || result.confidence < 0.6) return null;
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

    if (score >= 0.6)
        return { level: 'verified', source: best.source, score, label: `✅ Source fiable (${Math.round(score * 100)}%)` };

    if (score >= 0.3)
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

const D7_API_KEY = process.env.D7_API_KEY;
const EMERGENCY_PHONE = process.env.EMERGENCY_PHONE || "+212602641467";

const REQUIRED_FIELDS = ["symptom", "bodyPart", "duration", "age", "patientLocation", "intensity"];

const FIELD_QUESTIONS_FR = {
    symptom: "Quel est le symptôme principal que vous ressentez ?",
    bodyPart: "Quelle partie du corps est concernée ?",
    duration: "Depuis combien de temps durent ces symptômes ?",
    age: "Quel est l'âge du patient ?",
    patientLocation: "Où se trouve le patient en ce moment (ville, quartier, adresse) ?",
    intensity: "Sur une échelle de 1 à 10, quelle est l'intensité de la douleur ou de la gêne ?"
};

const FIELD_QUESTIONS_AR = {
    symptom: "ما هو العرض الرئيسي الذي تشعر به؟",
    bodyPart: "أي جزء من الجسم يشعر بالألم؟",
    duration: "منذ متى تعاني من هذه الأعراض؟",
    age: "كم عمرك؟",
    patientLocation: "أين أنت الآن (المدينة، الحي، العنوان)؟",
    intensity: "على مقياس من 1 إلى 10، ما شدة الألم أو الانزعاج الذي تشعر به؟"
};

const FIELD_QUESTIONS_DARIJA = {
    symptom: "شنو هو العرض الرئيسي اللي كتحس بيه؟",
    bodyPart: "فين كا توجعك بالضبط؟",
    duration: "من فوقاش كا تحس بهاد الشي؟",
    age: "شحال عمرك؟",
    patientLocation: "فين كاين دابا (المدينة أو الحي)؟",
    intensity: "من 1 إلى 10، شحال كا توجعك (1 خفيف و10 بزاف)؟"
};

function getMissing(summary) {
    return REQUIRED_FIELDS.filter(f => {
        const val = summary[f];
        if (val === null || val === undefined || val === '') return true;
        if (f === 'intensity') {
            const n = Number(val);
            return isNaN(n) || n < 1 || n > 10;
        }
        return false;
    });
}

function isFieldAlreadyAskedIn(response, field, lang) {
    if (!response) return false;
    const fieldKeywordsFR = {
        symptom: ['symptôme', 'ressentez', 'problème', 'quoi'],
        bodyPart: ['partie', 'corps', 'où', 'localisation'],
        duration: ['combien de temps', 'depuis quand', 'durée'],
        age: ['âge', 'ans', 'quel âge'],
        patientLocation: ['où', 'ville', 'adresse', 'localisation'],
        intensity: ['échelle', 'intensité', 'douleur', '1 à 10', '1-10']
    };
    const fieldKeywordsAR = {
        symptom: ['العرض', 'تشعر', 'ألم'],
        bodyPart: ['جزء', 'الجسم', 'أين'],
        duration: ['منذ', 'متى', 'وقت'],
        age: ['عمر', 'سنة', 'سنين'],
        patientLocation: ['أين', 'مدينة', 'عنوان'],
        intensity: ['مقياس', 'شدة', '10', 'درجة']
    };
    const fieldKeywordsDarija = {
        symptom: ['شنو', 'عرض', 'كتحس'],
        bodyPart: ['فين', 'توجعك', 'الجسم'],
        duration: ['فوقاش', 'وقت', 'قديش'],
        age: ['شحال', 'عمرك', 'سنة'],
        patientLocation: ['فين', 'مدينة', 'دابا'],
        intensity: ['شحال', '10', 'توجعك', 'بزاف']
    };

    const keywords = lang === 'fr' ? fieldKeywordsFR[field] :
        lang === 'darija' ? fieldKeywordsDarija[field] :
        fieldKeywordsAR[field];

    if (!keywords) return false;
    const lower = response.toLowerCase();
    return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

const SOURCE_LABELS = {
    'MinSante_Maroc': 'Ministère de la Santé Maroc',
    'CroixRouge_ICRC': 'Croix-Rouge Internationale (CICR)',
    'IFRC': 'Fédération Internationale Croix-Rouge (IFRC)',
    'WHO': 'Organisation Mondiale de la Santé (OMS)',
};

function detectLanguage(message) {
    const arabicChars = (message.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = message.replace(/\s/g, '').length;
    const arabicRatio = totalChars > 0 ? arabicChars / totalChars : 0;

    if (arabicRatio <= 0.2) return 'fr';

    const darijaKeywords = [
        'كاين', 'كاينة', 'كاينين', 'كيكون', 'كتكون', 'كندير', 'كندوز',
        'بزاف', 'شوية', 'دابا', 'دوك', 'البارح', 'امبارح', 'الصباح', 'الصبح',
        'وحدو', 'وحدها', 'وحدي', 'عندو', 'عندها', 'عندي', 'عمرو', 'عمرها', 'عمري',
        'فين', 'شنو', 'أشنو', 'علاش', 'حيت', 'باش', 'هضر', 'كلّا', 'خلّي',
        'متخليوش', 'توجعك', 'كتحس', 'كايدور', 'يدور', 'فوقاش', 'شحال', 'دوسيه'
    ];

    const lowerMsg = message.toLowerCase();
    let darijaScore = 0;
    for (const kw of darijaKeywords) {
        if (lowerMsg.includes(kw)) darijaScore++;
    }

    if (darijaScore >= 2 || /\bكا[يبتن]/.test(message)) return 'darija';
    return 'ar';
}

function convertArabicNumberToInt(text) {
    if (!text) return null;

    const arabicIndic = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    let normalized = text.replace(/[٠-٩]/g, d => arabicIndic[d]);

    const directMatch = normalized.match(/\b(\d{1,3})\b/);
    if (directMatch) {
        const n = parseInt(directMatch[1]);
        if (n >= 1 && n <= 120) return n;
    }

    const wordMap = {
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

function ageExplicitlyMentionedInMessage(message) {
    const frPatterns = [
        /\bil\s+a\s+\d+/i, /\belle\s+a\s+\d+/i, /\bj['']ai\s+\d+/i,
        /\b\d+\s*(ans?|an)\b/i, /\bâge\s*[:=]\s*\d+/i, /\bagé\s+de\s+\d+/i,
        /\bpatient\s+de\s+\d+/i, /\benfant\s+de\s+\d+/i, /\bfils\s+de\s+\d+/i,
        /\bfille\s+de\s+\d+/i, /\bmon\s+fils\s+.*?\d+/i, /\bma\s+fille\s+.*?\d+/i,
        /\bma\s+mère\s+.*?\d+/i, /\bmon\s+père\s+.*?\d+/i,
        /^\s*\d{1,3}\s*$/,
    ];
    const arPatterns = [
        /عندو\s+\d+/i, /عندها\s+\d+/i, /عندي\s+\d+/i,
        /عمره\s+\d+/i, /عمرها\s+\d+/i, /عمري\s+\d+/i,
        /\d+\s*(عام|سنة|سنين)/i, /عمر.*?\d+/i,
        /^\s*\d{1,3}\s*$/,
    ];

    const arWordsPatterns = [
        /عندي\s+(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)/i,
        /عمري\s+(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)/i,
        /عندو\s+(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)/i,
        /(عشرين|ثلاثين|أربعين|ربعين|خمسين|ستين|سبعين|ثمانين|تمانين|تسعين)\s*(عام|سنة|سنين)/i,
        /^[\u0600-\u06FF\s]{3,20}$/,
    ];

    for (const p of frPatterns) { if (p.test(message)) { console.log(`✅ [AGE FR] ${p}`); return true; } }
    for (const p of arPatterns) { if (p.test(message)) { console.log(`✅ [AGE AR] ${p}`); return true; } }
    for (const p of arWordsPatterns) { if (p.test(message)) { console.log(`✅ [AGE AR LETTRES] ${p}`); return true; } }

    console.log(`⛔ [AGE] Pas de mention explicite: "${message}"`);
    return false;
}

function intensityExplicitlyMentionedInMessage(message) {
    const frPatterns = [
        /\b([1-9]|10)\s*(\/\s*10|sur\s*10)?\b/i,
        /intensité\s*[:=]?\s*([1-9]|10)/i,
        /douleur\s+(très\s+)?(forte|légère|modérée|intense|sévère|faible)/i,
        /\bbeaucoup\b|\btrès\s+fort\b|\bun\s+peu\b|\bpas\s+trop\b/i,
    ];
    const arPatterns = [
        /\b([1-9]|10)\s*(من\s*10|\/\s*10)?\b/i,
        /شدة.*?([1-9]|10)/i,
        /بزاف|كثير|شوية|قليل|خفيف/i,
    ];
    const darijaPatterns = [
        /\b([1-9]|10)\b/,
        /بزاف|شوية|بحال\s+مايت|خفيف/i,
    ];

    for (const p of frPatterns) { if (p.test(message)) return true; }
    for (const p of arPatterns) { if (p.test(message)) return true; }
    for (const p of darijaPatterns) { if (p.test(message)) return true; }
    return false;
}

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
  - "عشرين" → 20, "ثلاثين" → 30, "أربعين" / "ربعين" → 40
  - "خمسين" → 50, "ستين" → 60, "سبعين" → 70
  - "ثمانين" / "تمانين" → 80, "تسعين" → 90
  - "واحد وعشرين" → 21, "خمسة وثلاثين" → 35
  - "20", "44", "عندي 20", "عمري 20", "عندو 20" → extraire le nombre
  - Le mot "عام" / "سنة" / "ans" est OPTIONNEL
  - Si l'assistant vient de demander l'âge et le patient répond un mot ou nombre → age = ce nombre converti

▸ INTENSITÉ — UNIQUEMENT un entier de 1 à 10 ou null :
  - "بزاف" / "كثير" → 7
  - "شوية" / "قليلا" → 3
  - "بحال مايت" / "لا أتحمل" → 9
  - "خفيف" / "un peu" → 2
  - "fort" / "très fort" → 8
  - Chiffre direct (ex: "7", "٧") → extraire directement
  - JAMAIS un mot comme "urgent", "critique", "modere" → null

▸ DURÉE — normaliser en français :
  - "البارح" / "امبارح" → "depuis hier"
  - "من الصباح" / "من الصبح" → "depuis ce matin"
  - "ثلاث ساعات" / "3 ساعات" → "depuis 3 heures"
  - "يومين" → "depuis 2 jours", "أسبوع" / "جمعة" → "depuis une semaine"
  - "من شهر" → "depuis un mois"

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
  - Si le patient dit "لا" / "للا" en réponse à une question → ignorer pour les champs
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

            if (parsed.age === null || parsed.age === undefined) {
                const converted = convertArabicNumberToInt(message);
                if (converted && ageExplicitlyMentionedInMessage(message)) {
                    parsed.age = converted;
                    console.log(`✅ [AGE CONVERTI LETTRES] "${message}" → ${converted}`);
                }
            }

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
Langue: ${lang === 'fr' ? 'français direct' : lang === 'darija' ? 'darija marocain UNIQUEMENT — sans mélange français' : 'arabe standard UNIQUEMENT — sans mélange français'}
Format: liste numérotée, max 5 étapes. ${isCritique ? 'Commence par appeler le 141.' : ''}
Réponds UNIQUEMENT avec les instructions, sans introduction ni salutation.`;
    } else {
        let instructionsList;
        if (lang === 'fr') {
            instructionsList = [
                'Appelez le 141',
                'Allongez le patient confortablement',
                'Ne donnez aucun médicament sans avis médical',
                'Surveillez la respiration et la conscience',
                'Ne laissez pas le patient seul'
            ];
        } else if (lang === 'darija') {
            instructionsList = [
                'اتصل بالإسعاف على الرقم 141',
                'خلي المريض يستريح فوضعة مريحة',
                'ما تعطيوش أي دواء بلا رأي الطبيب',
                'راقب التنفس ومستوى الوعي',
                'متخليوش المريض وحدو حتى يوصل الإسعاف'
            ];
        } else {
            instructionsList = [
                'اتصل بالإسعاف على الرقم 141',
                'أضجع المريض في وضعية مريحة',
                'لا تعط أي دواء دون استشارة الطبيب',
                'راقب التنفس ومستوى الوعي',
                'لا تترك المريض وحده حتى وصول الإسعاف'
            ];
        }

        firstAidPrompt = `Tu es un médecin urgentiste.
Donne ces 5 mesures en ${lang === 'fr' ? 'français direct' : lang === 'darija' ? 'darija marocain UNIQUEMENT — sans mélange français — sans salutation' : 'arabe standard UNIQUEMENT — sans mélange français — sans salutation'} :
1. ${instructionsList[0]}
2. ${instructionsList[1]}
3. ${instructionsList[2]}
4. ${instructionsList[3]}
5. ${instructionsList[4]}
Réponds UNIQUEMENT avec ces 5 instructions numérotées, sans introduction.`;
    }

    let firstAidInstructions = '';
    try {
        const _aid = await callGroq(firstAidPrompt);
        firstAidInstructions = _aid ? _aid.trim() : '';
    } catch (e) {
        if (lang === 'fr') firstAidInstructions = '1. Appelez le 141\n2. Allongez le patient\n3. Ne laissez pas seul';
        else if (lang === 'darija') firstAidInstructions = '1. اتصل بـ 141\n2. خلي المريض يستريح\n3. متخليوش وحدو';
        else firstAidInstructions = '1. اتصل بـ 141\n2. أضجع المريض\n3. لا تتركه وحده';
    }

    let reply;
    if (isCritique) {
        if (lang === 'fr') reply = `🚨🚨 **URGENCE CRITIQUE — ACTION IMMÉDIATE** 🚨🚨\n\n${firstAidInstructions}\n\n✅ Le dossier a été transmis.`;
        else if (lang === 'darija') reply = `🚨🚨 **حالة طارئة — تصرف فوري** 🚨🚨\n\n${firstAidInstructions}\n\n✅ تم إرسال الدوسيه للفريق المختص.`;
        else reply = `🚨🚨 **حالة طارئة — تصرف فوري** 🚨🚨\n\n${firstAidInstructions}\n\n✅ تم إرسال الملف للفريق المختص.`;
    } else {
        if (lang === 'fr') reply = `⚠️ **Alerte médicale**\n\n${firstAidInstructions}\n\n✅ Le dossier a été transmis.`;
        else if (lang === 'darija') reply = `⚠️ **تنبيه طبي — الوضع يحتاج تدخل سريع**\n\n${firstAidInstructions}\n\n✅ تم إرسال الدوسيه للفريق المختص.`;
        else reply = `⚠️ **تنبيه طبي — الوضع يحتاج تدخلاً سريعاً**\n\n${firstAidInstructions}\n\n✅ تم إرسال الملف للفريق المختص.`;
    }

    const confidence = protocole ?
        { level: 'verified', source: protocole.sourceLabel, score: 1.0, label: `✅ Protocole officiel — ${protocole.sourceLabel}` } :
        { level: 'unverified', source: null, score: 0, label: '⚠️ Instructions générales' };

    const missingAfterEmergency = REQUIRED_FIELDS.filter(f => !summary[f]);
    let finalReply = reply;

    if (missingAfterEmergency.length > 0) {
        let fieldQuestions;
        if (lang === 'fr') fieldQuestions = FIELD_QUESTIONS_FR;
        else if (lang === 'darija') fieldQuestions = FIELD_QUESTIONS_DARIJA;
        else fieldQuestions = FIELD_QUESTIONS_AR;

        const pendingQuestions = missingAfterEmergency.map(field => fieldQuestions[field]);
        let separator, questionsBlock;

        if (lang === 'fr') {
            separator = '\n\n─────────────────────────\n⚠️ **Informations nécessaires :**\n';
        } else if (lang === 'darija') {
            separator = '\n\n─────────────────────────\n⚠️ **معلومات ضرورية للإسعاف:**\n';
        } else {
            separator = '\n\n─────────────────────────\n⚠️ **معلومات ضرورية للإسعاف:**\n';
        }

        questionsBlock = pendingQuestions.map((q, i) => `📋 ${i + 1}. ${q}`).join('\n');
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

async function generateSmartResponse(
    userMessage, ragResults, summary, conversationHistory,
    emergencyEval, lang, missingFields,
    userMedicalHistory = null, userAge = null, userGender = null
) {
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
        ragConstraint = `⛔ Aucune source RAG — génère des conseils généraux adaptés au symptôme collecté, sans inventer de protocole.`;
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

    const isCasNonCritique = (emergencyEval && emergencyEval.level === 'modere') || (emergencyEval && emergencyEval.level === 'faible');
    const hasEnoughForAdvice = summary.symptom && (summary.bodyPart || summary.duration);

    let collectionInstruction;
    if (missingFields.length === 0) {
        collectionInstruction = `✅ Toutes les informations sont collectées. Donne un conseil médical complet et adapté.`;
    } else if (isCasNonCritique && hasEnoughForAdvice) {
        collectionInstruction = `✅ COMPORTEMENT ATTENDU pour un cas ${emergencyEval?.level} :
1. Commence par donner un conseil médical utile et rassurant (2-3 lignes) basé sur ce qui est déjà collecté.
2. Ensuite, pose UNE SEULE question pour collecter le champ manquant le plus important : "${missingFields[0]}".
Ne pose PAS plusieurs questions en même temps. Ne répète PAS les questions déjà posées dans l'historique.`;
    } else if (isCasNonCritique && !hasEnoughForAdvice) {
        collectionInstruction = `⛔ Pas encore assez d'informations pour donner un conseil. Pose UNE SEULE question pour obtenir : "${missingFields[0]}". Sois bref et bienveillant.`;
    } else {
        collectionInstruction = `⛔ NE pose PAS de question. Accuse réception en 1 ligne. La question sera ajoutée automatiquement.`;
    }

    let langInstruction;
    if (lang === 'fr') langInstruction = `LANGUE : Français direct. Pas de salutation.`;
    else if (lang === 'darija') langInstruction = `LANGUE : Réponds en darija marocain UNIQUEMENT. Zéro mélange français. Pas de salutation.`;
    else langInstruction = `LANGUE : Réponds en arabe standard UNIQUEMENT. Zéro mélange français ou darija. Pas de salutation.`;

    const prompt = `Tu es un agent médical d'urgence. Tu comprends le darija marocain, l'arabe standard et le français.

${langInstruction}

RÈGLES :
- Réponses courtes et claires
- Une seule question à la fois maximum
- Pas de bavardage ni d'introduction
- Si "لا" ou "للا" = réponse négative → ne pas stocker comme symptôme
- Pour les cas modérés/faibles : être rassurant et donner des conseils concrets

HISTORIQUE :
${historyText || "(début)"}

MESSAGE : "${userMessage}"

COLLECTÉ :
${collectedInfo || "(rien)"}${antecedentsInfo}

NIVEAU D'URGENCE : ${emergencyEval?.level || 'modere'}

${ragContext}
${ragConstraint}

${collectionInstruction}

RÉPONSE :`;

    try {
        const response = await callGroq(prompt);
        if (!response) {
            if (lang === 'fr') return "Service momentanément indisponible. Réessayez.";
            if (lang === 'darija') return "عذراً، الخدمة مشغولة. عاود المحاولة.";
            return "عذراً، الخدمة غير متاحة حالياً. حاول مرة أخرى.";
        }
        return response.trim();
    } catch (error) {
        if (lang === 'fr') return "Désolé, erreur de traitement. Réessayez.";
        if (lang === 'darija') return "عذراً، ما قدرتش نعالج طلبك. عاود المحاولة.";
        return "عذراً، حدث خطأ في المعالجة. حاول مرة أخرى.";
    }
}

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
    console.log(`🌐 [LANGUE] ${lang === 'fr' ? 'Français' : lang === 'darija' ? 'Darija marocain' : 'Arabe standard'}`);

    console.log("\n🧠 [EXTRACTION] Analyse sémantique...");
    const extracted = await extractWithGroq(userMessage, currentSummary, conversationHistory, userMedicalHistory, userAge, userGender);

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

    if (currentSummary.intensity) {
        updatedSummary.intensity = currentSummary.intensity;
        console.log(`✅ [INTENSITY CONSERVÉE] ${currentSummary.intensity}`);
    } else if (extracted.intensity !== null && extracted.intensity !== undefined) {
        const n = Number(extracted.intensity);
        if (!isNaN(n) && n >= 1 && n <= 10) {
            updatedSummary.intensity = n;
            console.log(`✅ [FUSION] intensity = ${n}`);
        }
    } else if (intensityExplicitlyMentionedInMessage(userMessage)) {
        const numMatch = userMessage.match(/\b([1-9]|10)\b/);
        if (numMatch) {
            const n = parseInt(numMatch[1]);
            updatedSummary.intensity = n;
            console.log(`✅ [INTENSITY FALLBACK] "${userMessage}" → ${n}`);
        }
    }

    if (currentSummary.age) {
        updatedSummary.age = currentSummary.age;
        console.log(`✅ [AGE CONSERVÉ] ${currentSummary.age}`);
    } else if (extracted.age !== null && extracted.age !== undefined && ageExplicitlyMentionedInMessage(userMessage)) {
        updatedSummary.age = extracted.age;
        console.log(`✅ [AGE ACCEPTÉ LLM] ${extracted.age}`);
    } else {
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

    console.log("\n⚠️ [URGENCE] Évaluation...");
    const emergencyEval = await evaluateEmergencyByLLM(userMessage, updatedSummary, conversationHistory, userMedicalHistory, userAge);

    if (
        emergencyEval.needsImmediateAction &&
        (emergencyEval.level === 'critique' || emergencyEval.level === 'urgent')
    ) {
        if (updatedSummary.symptom) {
            console.log(`🚨 [${emergencyEval.level.toUpperCase()}] Déclenchement`);
            const emergencyResult = await handleHighEmergency(userMessage, updatedSummary, sessionId, lang, emergencyEval.level, emergencyEval.reasoning);

            const emergencyConfidence = calculateChatConfidence({
                groqResponse: emergencyResult.reply,
                userMessage,
                ragResult: emergencyResult.ragUsed ? { matched: true, confidence: 1 } : null,
                extractedInfo: extracted
            });

            emergencyResult.confidence = emergencyConfidence;

            if (emergencyConfidence.score < CONFIDENCE_THRESHOLD) {
                await sendEmergencySMS(updatedSummary, sessionId, `Confiance faible (${emergencyConfidence.score.toFixed(2)}) sur urgence ${emergencyEval.level}`);
            }

            return emergencyResult;
        }

        let urgentCollect;
        if (lang === 'fr') {
            urgentCollect = `⚠️ **Situation préoccupante**\n\n1. Allongez le patient\n2. Pas de médicament\n3. Surveillez la respiration\n\nQuel est le symptôme principal ?`;
        } else if (lang === 'darija') {
            urgentCollect = `⚠️ **الوضع خطير**\n\n1. خلي المريض يستريح\n2. ما تعطيوش دواء\n3. راقب التنفس\n\nشنو هو العرض الرئيسي؟`;
        } else {
            urgentCollect = `⚠️ **الوضع خطير**\n\n1. أضجع المريض\n2. لا تعط دواء\n3. راقب التنفس\n\nما هو العرض الرئيسي؟`;
        }

        const urgentConfidence = calculateChatConfidence({
            groqResponse: urgentCollect,
            userMessage,
            ragResult: null,
            extractedInfo: extracted
        });

        if (urgentConfidence.score < CONFIDENCE_THRESHOLD) {
            await sendEmergencySMS(updatedSummary, sessionId, `Confiance faible (${urgentConfidence.score.toFixed(2)}) sur collecte urgente`);
        }

        return {
            reply: urgentCollect,
            extractedInfo: extracted,
            intent: "urgent_collect",
            severity: emergencyEval.level,
            updatedSummary,
            confidence: urgentConfidence
        };
    }

    console.log("\n🔍 [RAG] Recherche...");
    const searchQuery = updatedSummary.symptom ?
        `${updatedSummary.symptom} ${updatedSummary.bodyPart || ''} ${userMessage}`.trim() : userMessage;
    const ragResults = await searchRAG(searchQuery, lang);

    let bestRag = null;
    if (ragResults && ragResults.length > 0) {
        bestRag = {
            matched: true,
            confidence: ragResults[0].similarity,
            source: ragResults[0].source,
            content: ragResults[0].content
        };
    }

    const missing = getMissing(updatedSummary);
    console.log(`📋 [MANQUANTS] ${missing.length > 0 ? missing.join(', ') : 'Aucun ✅'}`);

    console.log("\n💬 [GROQ] Génération réponse...");
    const medicalResponse = await generateSmartResponse(
        userMessage,
        ragResults,
        updatedSummary,
        conversationHistory,
        emergencyEval,
        lang,
        missing,
        userMedicalHistory,
        userAge,
        userGender
    );

    const confidence = calculateChatConfidence({
        groqResponse: medicalResponse,
        userMessage,
        ragResult: bestRag,
        extractedInfo: extracted
    });

    console.log(`🔒 [CONFIANCE CHAT] ${confidence.label}`);

    if (confidence.score < CONFIDENCE_THRESHOLD) {
        await sendEmergencySMS(updatedSummary, sessionId, `Confiance faible (${confidence.score.toFixed(2)}) sur réponse chat`);
    }

    let finalReply = medicalResponse;

    if (missing.length > 0) {
        const isCasNonCritique = emergencyEval.level === 'modere' || emergencyEval.level === 'faible';
        const nextField = missing[0];

        let fieldQuestions;
        if (lang === 'fr') fieldQuestions = FIELD_QUESTIONS_FR;
        else if (lang === 'darija') fieldQuestions = FIELD_QUESTIONS_DARIJA;
        else fieldQuestions = FIELD_QUESTIONS_AR;

        const fieldQuestion = fieldQuestions[nextField];

        if (isCasNonCritique) {
            const alreadyHasQuestion = medicalResponse.includes('?') || medicalResponse.includes('؟');
            if (!alreadyHasQuestion) {
                finalReply = medicalResponse.trimEnd() + `\n\n📋 **${fieldQuestion}**`;
                console.log(`📌 [FORCE QUESTION non-critique] "${nextField}"`);
            } else {
                console.log(`✅ [QUESTION DÉJÀ PRÉSENTE] LLM a posé une question, pas de doublon`);
            }
        } else {
            if (!isFieldAlreadyAskedIn(medicalResponse, nextField, lang)) {
                finalReply = medicalResponse.trimEnd() + `\n\n📋 **${fieldQuestion}**`;
                console.log(`📌 [FORCE QUESTION critique] "${nextField}"`);
            }
        }
    }

    if (missing.length === 0 && !currentSummary._complete) {
        console.log(`✅ [COMPLET] Envoi au PFA`);
        await sendToPFA(updatedSummary, sessionId);

        const severity = evaluateSeverity(updatedSummary, userMedicalHistory);
        const protocole = await getProtocoleFromRAG(updatedSummary, lang);

        let instructionsPrompt;
        if (protocole) {
            instructionsPrompt = `Instructions de premiers secours depuis ce protocole (${protocole.sourceLabel}) :
${protocole.content}
Symptôme: ${updatedSummary.symptom}, Partie: ${updatedSummary.bodyPart}, Âge: ${updatedSummary.age}, Intensité: ${updatedSummary.intensity}/10
Langue: ${lang === 'fr' ? 'français' : lang === 'darija' ? 'darija marocain UNIQUEMENT — sans mélange français' : 'arabe standard UNIQUEMENT — sans mélange français'}
Format: liste numérotée, max 5 étapes, sans introduction.`;
        } else {
            instructionsPrompt = `Instructions de sécurité universelles.
Symptôme: ${updatedSummary.symptom}, Âge: ${updatedSummary.age}, Intensité: ${updatedSummary.intensity}/10
Langue: ${lang === 'fr' ? 'français' : lang === 'darija' ? 'darija marocain UNIQUEMENT — sans mélange français' : 'arabe standard UNIQUEMENT — sans mélange français'}
3 étapes max : surveiller, hydrater si possible, consulter si aggravation.`;
        }

        let instructions = '';
        try {
            const _inst = await callGroq(instructionsPrompt);
            instructions = _inst ? _inst.trim() : '';
        } catch (e) {
            if (lang === 'fr') instructions = 'Surveillez et consultez un médecin.';
            else if (lang === 'darija') instructions = 'راقب المريض واستشير طبيباً.';
            else instructions = 'راقب المريض واستشر طبيباً.';
        }

        let sourceBadge = '';
        if (protocole) {
            if (lang === 'fr') sourceBadge = `\n\n📋 **Protocole officiel — ${protocole.sourceLabel}**`;
            else sourceBadge = `\n\n📋 **بروتوكول رسمي — ${protocole.sourceLabel}**`;
        }

        let completionMsg;
        if (lang === 'fr') completionMsg = `✅ **Dossier complet — transmis à l'équipe médicale**\n\n${instructions}${sourceBadge}`;
        else if (lang === 'darija') completionMsg = `✅ **تم جمع المعلومات — الدوسيه أُرسل للفريق الطبي**\n\n${instructions}${sourceBadge}`;
        else completionMsg = `✅ **تم جمع المعلومات — تم إرسال الملف للفريق الطبي**\n\n${instructions}${sourceBadge}`;

        const completionConfidence = calculateChatConfidence({
            groqResponse: completionMsg,
            userMessage,
            ragResult: protocole ? { matched: true, confidence: 1 } : bestRag,
            extractedInfo: extracted
        });

        if (completionConfidence.score < CONFIDENCE_THRESHOLD) {
            await sendEmergencySMS(updatedSummary, sessionId, `Confiance faible (${completionConfidence.score.toFixed(2)}) sur complétion`);
        }

        return {
            reply: completionMsg,
            extractedInfo: extracted,
            intent: "complete",
            severity,
            esoSummary: updatedSummary,
            updatedSummary: {...updatedSummary, _complete: true },
            ragUsed: !!protocole,
            confidence: completionConfidence
        };
    }

    if (missing.length === 0 && currentSummary._complete) {
        let alreadyDoneMsg;
        if (lang === 'fr') alreadyDoneMsg = "Le dossier a déjà été transmis. En cas d'aggravation, appelez le 141.";
        else if (lang === 'darija') alreadyDoneMsg = 'تم إرسال الدوسيه بالفعل. إذا كانت الحالة تتفاقم، اتصل بـ 141.';
        else alreadyDoneMsg = 'تم إرسال الملف بالفعل. إذا كانت الحالة تتفاقم، اتصل بـ 141.';

        const doneConfidence = calculateChatConfidence({
            groqResponse: alreadyDoneMsg,
            userMessage,
            ragResult: bestRag,
            extractedInfo: extracted
        });

        if (doneConfidence.score < CONFIDENCE_THRESHOLD) {
            await sendEmergencySMS(updatedSummary, sessionId, `Confiance faible (${doneConfidence.score.toFixed(2)}) sur dossier déjà transmis`);
        }

        return {
            reply: alreadyDoneMsg,
            extractedInfo: extracted,
            intent: "complete",
            severity: evaluateSeverity(updatedSummary, userMedicalHistory),
            esoSummary: updatedSummary,
            updatedSummary,
            ragUsed: false,
            confidence: doneConfidence
        };
    }

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