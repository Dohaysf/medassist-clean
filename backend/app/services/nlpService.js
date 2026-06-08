// backend/app/services/nlpService.js
const fs = require("fs");
const path = require("path");

// ================= NORMALISATION =================
const normalizeText = (text) => {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ");
};

// ================= DICTIONNAIRES =================
const SYMPTOM_KEYWORDS = {
    douleur: ["mal", "douleur", "douloureux", "fait mal"],
    dyspnee: ["respire", "essoufflement", "souffle", "oppression", "respirer", "suffocation", "étouffement"],
    cardiaque: ["coeur", "cardiaque", "poitrine", "thorax", "infarctus", "crise cardiaque"],
    nausee: ["nausée", "vomissement", "mal au coeur"],
    fievre: ["fièvre", "temperature", "chaud", "frissons"],
    traumatisme: ["chute", "accident", "coup", "blessure"],
    saignement: ["saigne", "sang", "hémorragie", "perte de sang"],
    brulure: ["brûlure", "brulure", "crampe"],
    inconscience: ["inconscient", "évanouissement", "coma", "perte connaissance", "ne répond plus"],
    hemorragie: ["hémorragie", "saignement abondant", "perte sang"]
};

const BODY_PARTS = {
    tete: ["tête", "tete", "crâne", "front", "nuque"],
    poitrine: ["poitrine", "thorax", "sternum"],
    ventre: ["ventre", "abdomen", "estomac"],
    dos: ["dos", "lombaires"],
    jambe: ["jambe", "cuisse", "mollet", "genou"],
    bras: ["bras", "avant-bras", "coude", "épaule"],
    cou: ["cou", "nuque"],
    pied: ["pied", "cheville"],
    main: ["main", "poignet"],
    poumon: ["poumon", "poumons", "bronches", "respiration"]
};

// ================= MOTS-CLÉS URGENCE CRITIQUE =================
const CRITICAL_KEYWORDS = [
    // Respiratoire
    'ne respire plus', 'ne respire pas', 'respire plus', 'respire pas',
    'difficulté à respirer', 'difficulté respiratoire', 'peux pas respirer',
    'je ne peux pas respirer', 'je peux pas respirer', 'ne peut pas respirer',
    'étouffement', 'suffocation', 'asphyxie', "manque d'air", 'essoufflement severe',
    'respiration difficile', 'haletant', 'respire mal',

    // Cardiaque
    'crise cardiaque', 'infarctus', 'arrêt cardiaque', 'arrêt respiratoire',
    'douleur thoracique', 'douleur poitrine', 'serrement poitrine',
    'douleur bras gauche', 'douleur irradie bras', 'irradiation bras gauche',

    // AVC
    'avc', 'accident vasculaire', 'paralysie', 'visage tombant', 'bouche tordue',
    'trouble de la parole', 'ne parle plus', 'parle mal', 'vision double',
    'trouble vision', 'mal à la tête soudain', 'céphalée brutale',

    // Inconscience
    'inconscience', 'évanouissement', 'perte de connaissance', 'coma',
    'ne répond plus', 'ne bouge plus', 'est inconscient',

    // Hémorragie
    'hémorragie grave', 'saignement abondant', 'perte de sang importante'
];

// ================= DÉTECTION URGENCE CRITIQUE =================
const isCriticalEmergency = (message) => {
    const msg = message.toLowerCase().trim();

    for (const kw of CRITICAL_KEYWORDS) {
        if (msg.includes(kw)) {
            console.log(`🚨 [CRITICAL] Mot-clé détecté: "${kw}"`);
            return true;
        }
    }

    // Problème respiratoire combiné
    if (
        (msg.includes('respir') || msg.includes('souffle')) &&
        (msg.includes('pas') || msg.includes('plus') || msg.includes('difficile') || msg.includes('mal'))
    ) {
        console.log(`🚨 [CRITICAL] Problème respiratoire détecté`);
        return true;
    }

    // Douleur poitrine + bras gauche → signe d'infarctus
    if (
        (msg.includes('poitrine') || msg.includes('thorax')) &&
        (msg.includes('bras') || msg.includes('épaule') || msg.includes('mâchoire'))
    ) {
        console.log(`🚨 [CRITICAL] Signes d'infarctus détectés (poitrine + bras/épaule/mâchoire)`);
        return true;
    }

    return false;
};

// ================= EXTRACTION AMÉLIORÉE =================
const extractInfo = (message, summary = {}) => {
    const normalized = normalizeText(message);
    const originalMsg = message.toLowerCase();
    const info = {};

    // Symptôme
    for (const [symptom, keywords] of Object.entries(SYMPTOM_KEYWORDS)) {
        if (keywords.some(k => normalized.includes(normalizeText(k)))) {
            info.symptom = symptom;
            break;
        }
    }

    // Vérification supplémentaire pour les problèmes respiratoires
    if (originalMsg.includes('respir') || originalMsg.includes('souffle')) {
        info.symptom = 'dyspnee';
    }

    // Vérification pour douleur thoracique
    if (
        (originalMsg.includes('douleur') || originalMsg.includes('mal')) &&
        (originalMsg.includes('poitrine') || originalMsg.includes('thorax'))
    ) {
        info.symptom = 'cardiaque';
        info.bodyPart = 'poitrine';
    }

    // Partie du corps
    for (const [part, variants] of Object.entries(BODY_PARTS)) {
        if (variants.some(v => normalized.includes(normalizeText(v)))) {
            info.bodyPart = part;
            break;
        }
    }

    // Durée
    const durationMatch = normalized.match(/(\d+)\s*(minute|minutes|heure|heures|jour|jours|h|min|j)/);
    if (durationMatch) {
        const number = parseInt(durationMatch[1], 10);
        let unit = durationMatch[2];
        if (unit === 'jour' && number > 1) unit = 'jours';
        if (unit === 'minute' && number > 1) unit = 'minutes';
        if (unit === 'heure' && number > 1) unit = 'heures';
        info.duration = `${number} ${unit}`;
    } else if (normalized.includes("depuis ce matin")) {
        info.duration = "depuis ce matin";
    } else if (normalized.includes("depuis hier")) {
        info.duration = "depuis hier";
    } else if (normalized.includes("hier")) {
        info.duration = "1 jour";
    } else if (normalized.includes("avant-hier")) {
        info.duration = "2 jours";
    } else if (normalized.includes("depuis quelques")) {
        info.duration = "quelques instants";
    }

    // Intensité (1-10)
    const intensityMatch = normalized.match(/(\d+)\s*\/\s*10|(\d+)\s*sur\s*10/);
    if (intensityMatch) {
        const intensity = parseInt(intensityMatch[1] || intensityMatch[2], 10);
        if (intensity >= 1 && intensity <= 10) info.intensity = intensity;
    } else if (
        originalMsg.includes('très fort') || originalMsg.includes('très forte') ||
        originalMsg.includes('insupportable') || originalMsg.includes('atroce')
    ) {
        info.intensity = 9;
    } else if (originalMsg.includes('fort') || originalMsg.includes('forte') || originalMsg.includes('intense')) {
        info.intensity = 7;
    } else if (originalMsg.includes('légère') || originalMsg.includes('légèrement') || originalMsg.includes('peu')) {
        info.intensity = 3;
    }

    // Âge (0-120)
    const ageMatch = normalized.match(/(\d+)\s*ans/);
    if (ageMatch) {
        const age = parseInt(ageMatch[1], 10);
        if (age >= 0 && age <= 120) info.age = age;
    }

    // Localisation — patterns courants
    const locationPatterns = [
        /(?:je suis|on est|il est|elle est|nous sommes|se trouve)\s+[àa]\s+([\w\s-]+)/i,
        /(?:habitons?|habite)\s+[àa]\s+([\w\s-]+)/i,
        /(?:domicile|adresse|maison|chez moi)\s*(?:[àa:])?\s*([\w\s-]+)/i,
        /(?:quartier|rue|boulevard|avenue|hay)\s+([\w\s-]+)/i,
        /[àa]\s+(casablanca|rabat|marrakech|agadir|tanger|fes|meknes|oujda|kenitra|tetouan|safi|mohammedia|temara|sale|beni mellal|nador|settat|khouribga|berrechid|khenifra|larache|guelmim|laayoune|dakhla)([\w\s-]*)/i,
    ];

    for (const pattern of locationPatterns) {
        const match = originalMsg.match(pattern);
        if (match) {
            info.patientLocation = match[1].trim();
            break;
        }
    }

    // Fallback : si le message contient une ville connue
    const VILLES_MAROC = [
        'casablanca', 'rabat', 'marrakech', 'agadir', 'tanger', 'fes', 'meknes',
        'oujda', 'kenitra', 'tetouan', 'safi', 'mohammedia', 'temara', 'sale',
        'beni mellal', 'nador', 'settat', 'khouribga', 'berrechid', 'khenifra',
        'larache', 'guelmim', 'laayoune', 'dakhla', 'ifrane', 'azrou', 'ouarzazate',
        'errachidia', 'taroudant', 'tiznit', 'chefchaouen', 'al hoceima'
    ];

    if (!info.patientLocation) {
        for (const ville of VILLES_MAROC) {
            if (originalMsg.includes(ville)) {
                info.patientLocation = ville.charAt(0).toUpperCase() + ville.slice(1);
                break;
            }
        }
    }

    return info;
};

// ================= ÉVALUATION SÉVÉRITÉ =================
/**
 * Évalue la sévérité d'un cas médical à partir du résumé collecté.
 * Tient compte des antécédents médicaux du patient.
 *
 * @param {Object} summary - Résumé ESO collecté
 * @param {Object|null} userMedicalHistory - Antécédents du patient (diabete, asthme, tension, other)
 * @returns {'critique'|'urgent'|'modere'|'faible'}
 */
function evaluateSeverity(summary, userMedicalHistory = null) {
    const symptom = (summary.symptom || '').toLowerCase();
    const bodyPart = (summary.bodyPart || '').toLowerCase();
    const rawIntensity = summary.intensity;
    const intensityNum = typeof rawIntensity === 'number' ?
        rawIntensity :
        parseInt(String(rawIntensity || '0'), 10);
    const intensityStr = String(rawIntensity || '').toLowerCase();

    // ─────────────────────────────────────────────────────────────
    // NIVEAU CRITIQUE — Danger de mort immédiat
    // ─────────────────────────────────────────────────────────────

    // 1. Signes d'infarctus : douleur poitrine + irradiation bras/épaule/mâchoire
    const isChestPain =
        bodyPart.includes('poitrine') || bodyPart.includes('thorax') ||
        symptom.includes('poitrine') || symptom.includes('thorax') ||
        symptom.includes('cardiaque') || symptom.includes('infarctus');

    const hasRadiation =
        bodyPart.includes('bras') || bodyPart.includes('épaule') ||
        bodyPart.includes('machoire') || bodyPart.includes('mâchoire') ||
        bodyPart.includes('gauche');

    if (isChestPain && hasRadiation) {
        console.log('🔴 [SEVERITY] CRITIQUE — Signes d\'infarctus (poitrine + radiation)');
        return 'critique';
    }

    // 2. Inconscience / arrêt cardiaque / AVC
    const isUnconscious =
        symptom.includes('inconscient') || symptom.includes('inconscience') ||
        symptom.includes('perte de connaissance') || symptom.includes('coma') ||
        symptom.includes('ne répond plus') || symptom.includes('avc') ||
        symptom.includes('paralysie');

    if (isUnconscious) {
        console.log('🔴 [SEVERITY] CRITIQUE — Inconscience / AVC');
        return 'critique';
    }

    // 3. Détresse respiratoire sévère
    const isSevereRespiratory =
        (symptom.includes('dyspnee') || symptom.includes('respir') || symptom.includes('souffle')) &&
        (intensityNum >= 8 || intensityStr.includes('insupportable') ||
            intensityStr.includes('très fort') || intensityStr.includes('ne peut pas'));

    if (isSevereRespiratory) {
        console.log('🔴 [SEVERITY] CRITIQUE — Détresse respiratoire sévère');
        return 'critique';
    }

    // 4. Hémorragie grave
    const isSevereBleed =
        symptom.includes('hemorragie') || symptom.includes('hémorragie') ||
        (symptom.includes('saignement') &&
            (intensityNum >= 8 || intensityStr.includes('abondant') || intensityStr.includes('important')));

    if (isSevereBleed) {
        console.log('🔴 [SEVERITY] CRITIQUE — Hémorragie grave');
        return 'critique';
    }

    // ─────────────────────────────────────────────────────────────
    // NIVEAU URGENT — Consultation dans les heures qui suivent
    // ─────────────────────────────────────────────────────────────

    // 5. Douleur thoracique seule (sans radiation confirmée)
    if (isChestPain) {
        console.log('🟠 [SEVERITY] URGENT — Douleur thoracique');
        return 'urgent';
    }

    // 6. Intensité très élevée (≥ 8/10 ou "insupportable")
    if (
        intensityNum >= 8 ||
        intensityStr.includes('insupportable') ||
        intensityStr.includes('atroce') ||
        intensityStr.includes('très fort') ||
        intensityStr.includes('très forte')
    ) {
        console.log('🟠 [SEVERITY] URGENT — Intensité très élevée');
        return 'urgent';
    }

    // 7. Antécédents aggravants + symptôme significatif
    if (userMedicalHistory) {
        const hasRisk =
            userMedicalHistory.diabete ||
            userMedicalHistory.tension ||
            userMedicalHistory.asthme;

        const hasSignificantSymptom =
            symptom.includes('douleur') || symptom.includes('cardiaque') ||
            symptom.includes('dyspnee') || symptom.includes('saignement') ||
            isChestPain;

        if (hasRisk && hasSignificantSymptom) {
            console.log('🟠 [SEVERITY] URGENT — Antécédents + symptôme significatif');
            return 'urgent';
        }
    }

    // 8. Traumatisme grave (chute, accident, coup violent)
    if (
        symptom.includes('traumatisme') &&
        (intensityNum >= 7 || intensityStr.includes('fort') || intensityStr.includes('grave'))
    ) {
        console.log('🟠 [SEVERITY] URGENT — Traumatisme grave');
        return 'urgent';
    }

    // ─────────────────────────────────────────────────────────────
    // NIVEAU MODÉRÉ — Consultation dans la journée
    // ─────────────────────────────────────────────────────────────
    if (
        intensityNum >= 5 ||
        symptom.includes('douleur') || symptom.includes('fievre') ||
        symptom.includes('nausee') || symptom.includes('saignement')
    ) {
        console.log('🟡 [SEVERITY] MODÉRÉ');
        return 'modere';
    }

    // ─────────────────────────────────────────────────────────────
    // NIVEAU FAIBLE — Conseil médical
    // ─────────────────────────────────────────────────────────────
    console.log('🟢 [SEVERITY] FAIBLE');
    return 'faible';
}

// ================= EXPORT =================
module.exports = {
    extractInfo,
    evaluateSeverity,
    isCriticalEmergency,
    normalizeText,
    SYMPTOM_KEYWORDS,
    BODY_PARTS,
    CRITICAL_KEYWORDS
};