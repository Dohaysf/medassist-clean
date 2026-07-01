const fs = require('fs');
const path = require('path');
const axios = require('axios');

const RAG_DATA_PATH = path.join(process.cwd(), 'data', 'rag_knowledge_base.json');
const PROXY_URL = 'http://localhost:5001';
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.60');

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
            query: message,
            language: 'fr',
            top_k: 3
        }, { timeout: 10000 });

        console.log(`📦 Réponse brute du proxy:`, JSON.stringify(response.data));

        if (response.data && response.data.matched && Array.isArray(response.data.results) && response.data.results.length > 0) {
            const best = response.data.results[0];
            const similarity = Number(best.similarity) || 0;
            const key = best.key;
            const data = ragKnowledgeBase[key] || {};

            console.log(`📊 Similarité reçue: ${(similarity * 100).toFixed(1)}%`);
            console.log(`🎯 Seuil actuel: ${Math.round(SIMILARITY_THRESHOLD * 100)}%`);

            let protocol = null;
            if (best.protocole_oms !== undefined && best.protocole_oms !== null) {
                protocol = best.protocole_oms;
            } else if (data.protocole_oms !== undefined && data.protocole_oms !== null) {
                protocol = data.protocole_oms;
            }

            let urgency = false;
            if (best.urgence !== undefined && best.urgence !== null) {
                urgency = best.urgence;
            } else if (data.urgence !== undefined && data.urgence !== null) {
                urgency = data.urgence;
            }

            let priority = 4;
            if (best.priority !== undefined && best.priority !== null) {
                priority = best.priority;
            } else if (data.priority !== undefined && data.priority !== null) {
                priority = data.priority;
            }

            let decision = 'consult';
            if (data.decision !== undefined && data.decision !== null && data.decision !== '') {
                decision = data.decision;
            }

            let source = 'base_medicale';
            if (best.source !== undefined && best.source !== null && best.source !== '') {
                source = best.source;
            } else if (data.source !== undefined && data.source !== null && data.source !== '') {
                source = data.source;
            }

            let conseil = best.conseil;
            if (conseil === undefined || conseil === null || conseil === '') {
                if (data.conseil !== undefined && data.conseil !== null && data.conseil !== '') {
                    conseil = data.conseil;
                } else {
                    conseil = best.content;
                }
            }

            if (similarity >= SIMILARITY_THRESHOLD && key && data) {
                console.log(`✅ [VECTORIEL] Match trouvé: ${key} (${Math.round(similarity * 100)}%)`);
                return {
                    matched: true,
                    key: key,
                    data: {
                        ...data,
                        conseil: conseil,
                        protocole_oms: protocol,
                        urgence: urgency,
                        priority: priority,
                        decision: decision,
                        source: source
                    },
                    confidence: similarity
                };
            } else {
                console.log(`❌ Similarité ${(similarity * 100).toFixed(1)}% < ${Math.round(SIMILARITY_THRESHOLD * 100)}%`);
            }
        } else {
            console.log(`❌ Proxy a retourné matched=false ou résultats vides`);
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
            source: result.data.source,
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
            console.log(`🎯 Seuil de similarité: ${Math.round(SIMILARITY_THRESHOLD * 100)}%`);
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