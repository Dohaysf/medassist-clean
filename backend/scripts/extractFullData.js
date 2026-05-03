const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '../data/data_UM.json');
const OUTPUT_PATH = path.join(__dirname, '../data/rag_knowledge_base.json');

// Normalisation des accents
function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "");
}

// Mapping des symptômes français vers clés normalisées
const symptomMapping = {
    'douleur': 'douleur',
    'poitrine': 'poitrine',
    'thorax': 'poitrine',
    'dyspnee': 'respiration',
    'dyspnée': 'respiration',
    'fièvre': 'fievre',
    'fievre': 'fievre',
    'céphalée': 'tete',
    'céphalée': 'tete',
    'migraine': 'tete',
    'vomissements': 'vomissements',
    'nausée': 'nausee',
    'diarrhée': 'diarrhee',
    'fatigue': 'fatigue',
    'vertige': 'vertige',
    'toux': 'toux',
    'traumatisme': 'traumatisme',
    'hémorragie': 'hemorragie',
    'brûlure': 'brulure',
    'syncope': 'syncope',
    'malaise': 'malaise'
};

function cleanKey(key) {
    return key.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, '');
}

function getAdvice(urgencyLevel) {
    if (urgencyLevel === 'critical') {
        return "🚨 URGENCE VITALE : Appelez immédiatement le SAMU (141). Restez calme.";
    } else if (urgencyLevel === 'high') {
        return "⚠️ URGENCE : Consultez rapidement un médecin ou rendez-vous aux urgences.";
    } else if (urgencyLevel === 'medium') {
        return "📋 CONSULTATION : Prenez rendez-vous chez un médecin généraliste.";
    }
    return "💡 CONSEIL : Reposez-vous. Consultez si les symptômes persistent.";
}

function getPriority(urgencyLevel) {
    if (urgencyLevel === 'critical') return 1;
    if (urgencyLevel === 'high') return 2;
    if (urgencyLevel === 'medium') return 3;
    return 4;
}

console.log('📖 Lecture du fichier data_UM.json...');

try {
    const entries = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    console.log(`📊 ${entries.length} cas chargés`);
    
    const ragKnowledgeBase = {};
    
    for (const entry of entries) {
        const inputText = entry.conversation?.input_text || '';
        const language = entry.conversation?.language || 'unknown';
        const symptoms = entry.symptoms || [];
        const triage = entry.triage || {};
        const urgencyLevel = triage.urgency_level || 'low';
        
        for (const symptom of symptoms) {
            let symptomName = symptom.symptom || '';
            let location = symptom.location || '';
            
            // Nettoyer les noms
            symptomName = normalizeText(symptomName);
            location = normalizeText(location);
            
            // Appliquer le mapping
            symptomName = symptomMapping[symptomName] || symptomName;
            location = symptomMapping[location] || location;
            
            if (!symptomName || symptomName.length < 2) continue;
            
            let key = `${symptomName}_${location}`;
            key = cleanKey(key);
            
            if (!ragKnowledgeBase[key]) {
                ragKnowledgeBase[key] = {
                    conseil: getAdvice(urgencyLevel),
                    urgence: urgencyLevel === 'critical' || urgencyLevel === 'high',
                    priority: getPriority(urgencyLevel),
                    decision: triage.decision || 'consult',
                    mots_cles: [symptomName, location],
                    exemples: []
                };
            }
            
            ragKnowledgeBase[key].exemples.push({
                texte: inputText.substring(0, 200),
                langue: language
            });
        }
    }
    
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(ragKnowledgeBase, null, 2));
    console.log(`\n✅ Base RAG générée avec ${Object.keys(ragKnowledgeBase).length} entrées`);
    
    // Afficher les clés
    console.log('\n📋 CLÉS GÉNÉRÉES:');
    Object.keys(ragKnowledgeBase).slice(0, 10).forEach(key => {
        console.log(`   - ${key}`);
    });
    
} catch (error) {
    console.error('❌ Erreur:', error.message);
}