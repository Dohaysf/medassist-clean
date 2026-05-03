const fs = require('fs');
const path = require('path');

const RAG_PATH = path.join(__dirname, '../data/rag_knowledge_base.json');

console.log('📖 Lecture de la base RAG...');

try {
    const ragData = JSON.parse(fs.readFileSync(RAG_PATH, 'utf8'));
    
    // Dictionnaire des mots-clés à ajouter
    const enrichments = {
        'douleur_poitrine': {
            mots_cles_french: ['douleur', 'poitrine', 'thorax', 'coeur', 'cardiaque', 'oppression', 'serrement', 'mal au coeur', 'angine', 'crise cardiaque'],
            mots_cles_darija: ['وجع', 'صدر', 'فالصدر', 'صدري', 'sdr', 'قلب', 'ضغط', 'كيجع', 'فصدري', 'كنحس'],
            mots_cles_english: ['chest', 'pain', 'heart', 'cardiac', 'pressure', 'angina']
        },
        'fievre_general': {
            mots_cles_french: ['fièvre', 'fievre', 'température', 'chaud', 'brûlure', 'hyperthermie'],
            mots_cles_darija: ['سخانة', 'سخونة', 'سخون', 'حرارة', 'سخن', 'سخونة', 'سخون'],
            mots_cles_english: ['fever', 'temperature', 'hot', 'pyrexia']
        },
        'cephalee_tete': {
            mots_cles_french: ['tête', 'mal de tête', 'migraine', 'céphalée', 'crâne', 'cafard'],
            mots_cles_darija: ['راس', 'راسي', 'صداع', 'وجع راس', 'rassi', 'كيدوز', 'كيتوجع'],
            mots_cles_english: ['headache', 'head pain', 'migraine', 'cephalalgia']
        },
        'respiration_poitrine': {
            mots_cles_french: ['respiration', 'respirer', 'essoufflement', 'souffle', 'dyspnée', 'oppression', 'étouffement', 'asthme'],
            mots_cles_darija: ['تنفس', 'التنفس', 'tnfs', 'نفس', 'ضيق', 'مخنوق', 'كيتنفس', 'صعوبة'],
            mots_cles_english: ['breathing', 'breath', 'shortness', 'dyspnea', 'wheezing', 'asthma']
        }
    };
    
    let count = 0;
    
    for (const [key, enrichment] of Object.entries(enrichments)) {
        if (ragData[key]) {
            // Initialiser les tableaux s'ils n'existent pas
            if (!ragData[key].mots_cles_french) ragData[key].mots_cles_french = [];
            if (!ragData[key].mots_cles_darija) ragData[key].mots_cles_darija = [];
            if (!ragData[key].mots_cles_english) ragData[key].mots_cles_english = [];
            
            // Ajouter les mots-clés
            ragData[key].mots_cles_french.push(...enrichment.mots_cles_french);
            ragData[key].mots_cles_darija.push(...enrichment.mots_cles_darija);
            ragData[key].mots_cles_english.push(...enrichment.mots_cles_english);
            
            // Supprimer les doublons
            ragData[key].mots_cles_french = [...new Set(ragData[key].mots_cles_french)];
            ragData[key].mots_cles_darija = [...new Set(ragData[key].mots_cles_darija)];
            ragData[key].mots_cles_english = [...new Set(ragData[key].mots_cles_english)];
            
            count++;
            console.log(`✅ Enrichi: ${key}`);
            console.log(`   - Darija: ${ragData[key].mots_cles_darija.slice(0, 5).join(', ')}...`);
        }
    }
    
    // Sauvegarder
    fs.writeFileSync(RAG_PATH, JSON.stringify(ragData, null, 2));
    console.log(`\n✅ ${count} entrées enrichies`);
    console.log(`✅ Base RAG sauvegardée`);
    
} catch (error) {
    console.error('❌ Erreur:', error.message);
}