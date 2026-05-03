// backend/scripts/testRAG.js
const { getRAGResponse } = require('../app/services/ragService');

const tests = [
    "j'ai mal à la poitrine",
    "j'ai de la fièvre",
    "كنحس بوجع قوي فصدري",
    "عندي سخانة وصداع",
    "je n'arrive pas à respirer",
    "chest pain",
    "j'ai mal à la tête",
    "fever"
];

async function runTests() {
    console.log("🧪 TEST RAG\n");
    console.log("=".repeat(60));
    
    for (const msg of tests) {
        const res = await getRAGResponse(msg);
        console.log(`Message: "${msg}"`);
        console.log(`  → Match: ${res.matched ? '✅ ' + res.key : '❌'}`);
        if (res.matched) {
            console.log(`  → Confiance: ${Math.round(res.confidence * 100)}%`);
            console.log(`  → Urgence: ${res.urgency ? '🚨 OUI' : 'ℹ️ NON'}`);
            console.log(`  → Méthode: ${res.method || 'vector'}`);
        }
        console.log('');
    }
    
    console.log("=".repeat(60));
}

runTests().catch(console.error);