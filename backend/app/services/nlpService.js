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
  'étouffement', 'suffocation', 'asphyxie', 'manque d\'air', 'essoufflement severe',
  'respiration difficile', 'haletant', 'respire mal',
  
  // Cardiaque
  'crise cardiaque', 'infarctus', 'arrêt cardiaque', 'arrêt respiratoire',
  'douleur thoracique', 'douleur poitrine', 'serrement poitrine',
  
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
  
  // Problème respiratoire
  if ((msg.includes('respir') || msg.includes('souffle')) && 
      (msg.includes('pas') || msg.includes('plus') || msg.includes('difficile') || msg.includes('mal'))) {
    console.log(`🚨 [CRITICAL] Problème respiratoire détecté`);
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
    if (keywords.some(k => normalized.includes(k))) {
      info.symptom = symptom;
      break;
    }
  }
  
  // Vérification supplémentaire pour les problèmes respiratoires
  if (originalMsg.includes('respir') || originalMsg.includes('souffle')) {
    info.symptom = 'dyspnee';
  }
  
  // Vérification pour douleur thoracique
  if ((originalMsg.includes('douleur') || originalMsg.includes('mal')) && 
      (originalMsg.includes('poitrine') || originalMsg.includes('thorax'))) {
    info.symptom = 'cardiaque';
    info.bodyPart = 'poitrine';
  }

  // Partie du corps
  for (const [part, variants] of Object.entries(BODY_PARTS)) {
    if (variants.some(v => normalized.includes(v))) {
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
  } else if (normalized.includes("hier")) {
    info.duration = "1 jour";
  } else if (normalized.includes("avant-hier")) {
    info.duration = "2 jours";
  }

  // Intensité (1-10)
  let intensityMatch = normalized.match(/(\d+)\s*\/\s*10|(\d+)\s*sur\s*10/);
  if (intensityMatch) {
    const intensity = parseInt(intensityMatch[1] || intensityMatch[2], 10);
    if (intensity >= 1 && intensity <= 10) info.intensity = intensity;
  }

  // Âge (0-120)
  const ageMatch = normalized.match(/(\d+)\s*ans/);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (age >= 0 && age <= 120) info.age = age;
  }

  // Localisation simple
  if (normalized.includes("rue") || normalized.includes("quartier") ||
      normalized.includes("oujda") || normalized.includes("casablanca")) {
    info.patientLocation = message;
  }

  return info;
};

// ================= ÉVALUATION SÉVÉRITÉ AMÉLIORÉE =================
const evaluateSeverity = (summary) => {
  const symptom = (summary.symptom || '').toLowerCase();
  const bodyPart = (summary.bodyPart || '').toLowerCase();
  const intensity = Number(summary.intensity);
  const duration = summary.duration ? parseInt(summary.duration) : 0;

  console.log(`🔍 [SEVERITY] Symptôme: ${symptom}, BodyPart: ${bodyPart}, Intensity: ${intensity}`);

  // ✅ CAS CRITIQUES - Priorité absolue
  if (symptom.includes('dyspnee') || symptom.includes('respir') || 
      bodyPart.includes('poumon') || symptom.includes('souffle')) {
    console.log(`⚠️ [SEVERITY] CRITIQUE - Problème respiratoire`);
    return 'critique';
  }
  
  if (symptom.includes('cardiaque') || symptom.includes('coeur') || 
      (symptom.includes('douleur') && bodyPart.includes('poitrine'))) {
    console.log(`⚠️ [SEVERITY] CRITIQUE - Problème cardiaque`);
    return 'critique';
  }
  
  if (symptom.includes('hemorragie') || symptom.includes('saignement')) {
    console.log(`⚠️ [SEVERITY] CRITIQUE - Hémorragie`);
    return 'critique';
  }
  
  if (symptom.includes('inconscience')) {
    console.log(`⚠️ [SEVERITY] CRITIQUE - Perte de conscience`);
    return 'critique';
  }

  // Cas critiques standards
  if (symptom === 'cardiaque') return 'critique';
  if (symptom === 'douleur' && bodyPart === 'poitrine') return 'critique';
  if (symptom === 'dyspnee') return 'critique';
  if (symptom === 'saignement') return 'critique';
  
  // Combinaison intensité + durée
  if (intensity >= 8) return 'critique';
  if (intensity >= 5 && duration > 24) return 'critique';
  if (intensity >= 5) return 'moyenne';
  if (intensity >= 3) return 'faible';
  if (summary.symptom) return 'faible';
  
  return 'inconnue';
};

// ================= FALLBACK =================
const generateReply = (summary) => {
  if (!summary.symptom) return "Quel est le problème principal ?";
  if (!summary.bodyPart) return "Où avez-vous mal ?";
  if (!summary.duration) return "Depuis combien de temps ?";
  if (summary.intensity === undefined || summary.intensity === null)
    return "Sur une échelle de 1 à 10, quelle est l'intensité ?";
  if (!summary.age) return "Quel âge a le patient ?";
  if (!summary.patientLocation) return "Où se trouve le patient ?";
  return null;
};

const processMessage = (userMessage, currentSummary = {}) => {
  const extractedInfo = extractInfo(userMessage, currentSummary);
  const updatedSummary = { ...currentSummary, ...extractedInfo };
  const reply = generateReply(updatedSummary);
  
  return {
    reply: reply || "Merci. Toutes les informations sont enregistrées.",
    intent: "rules_fallback",
    extractedInfo: extractedInfo
  };
};

// ================= EXPORTS =================
module.exports = {
  processMessage,
  extractInfo,
  evaluateSeverity,
  normalizeText,
  isCriticalEmergency
};