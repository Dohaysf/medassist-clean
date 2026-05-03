const fs = require('fs');
const path = require('path');
const axios = require('axios');

const RAG_DATA_PATH = path.join(process.cwd(), 'data', 'rag_knowledge_base.json');
const PROXY_URL = 'http://localhost:5001';

console.log('=== RAG SERVICE 100% VECTORIEL ===');

let ragKnowledgeBase = {};

if (fs.existsSync(RAG_DATA_PATH)) {
    try {
        const data = fs.readFileSync(RAG_DATA_PATH, 'utf8');
        ragKnowledgeBase = JSON.parse(data);
        console.log(`✅ RAG chargée: ${Object.keys(ragKnowledgeBase).length} entrées`);
    } catch (err) {
        console.error('❌ Erreur chargement RAG:', err.message);
    }
}

async function searchVectorRAG(message) {
    try {
        console.log(`\n🔍 [VECTORIEL] Recherche: "${message.substring(0, 50)}..."`);
        
        const response = await axios.post(`${PROXY_URL}/search`, {
            message: message
        }, { timeout: 10000 });
        
        // Affiche la réponse brute du proxy (DEBUG)
        console.log(`📦 Réponse brute du proxy:`, JSON.stringify(response.data));
        
        if (response.data && response.data.matched) {
            const similarity = response.data.similarity;
            const key = response.data.key;
            const data = ragKnowledgeBase[key];
            
            console.log(`📊 Similarité reçue: ${(similarity * 100).toFixed(1)}%`);
            console.log(`🎯 Seuil actuel: 25%`);
            
            // ✅ Seuil à 25% (normal avec le modèle actuel)
            if (similarity > 0.25 && data) {
                console.log(`✅ [VECTORIEL] Match trouvé: ${key} (${Math.round(similarity * 100)}%)`);
                return {
                    matched: true,
                    key: key,
                    data: data,
                    confidence: similarity
                };
            } else {
                console.log(`❌ Similarité ${(similarity * 100).toFixed(1)}% < 25%`);
            }
        } else {
            console.log(`❌ Proxy a retourné matched=false`);
        }
        
        console.log(`❌ [VECTORIEL] Aucun match pour: "${message.substring(0, 50)}"`);
        return null;
    } catch (error) {
        console.error('❌ Erreur proxy:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('   → Proxy non accessible sur le port 5001');
        }
        return null;
    }
}

async function getRAGResponse(message) {
    const result = await searchVectorRAG(message);
    
    if (result && result.matched) {
        return {
            matched: true,
            reply: result.data.conseil,
            urgency: result.data.urgence === true,
            priority: result.data.priority,
            decision: result.data.decision || 'consult',
            key: result.key,
            confidence: result.confidence,
            method: "100% vectoriel"
        };
    }
    
    return { matched: false, confidence: 0 };
}

async function initChromaDB() {
    try {
        const response = await axios.get(`${PROXY_URL}/health`, { timeout: 3000 });
        
        if (response.data.status === 'ok') {
            console.log(`✅ Proxy RAG connecté`);
            console.log(`📁 Collection: ${response.data.collection}`);
            console.log(`📄 Documents: ${response.data.documents}`);
            console.log(`🔍 RECHERCHE 100% VECTORIELLE (PAS de mots-clés)`);
            console.log(`🎯 Seuil de similarité: 25%`);
            return true;
        } else {
            console.log('⚠️ Proxy RAG: collection non disponible');
            return false;
        }
    } catch (error) {
        console.error('❌ Proxy RAG non accessible:', error.message);
        console.log('💡 Lancez: python rag_proxy.py');
        return false;
    }
}

module.exports = { getRAGResponse, initChromaDB };