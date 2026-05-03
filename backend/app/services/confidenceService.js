// backend/app/services/confidenceService.js

/**
 * Calcule le score de confiance d'une réponse RAG
 * @param {Object} ragResult - Résultat de la recherche RAG
 * @param {string} userMessage - Message original
 * @returns {number} Score entre 0 et 1
 */
function calculateRAGConfidence(ragResult, userMessage) {
    // Si aucun match, confiance = 0
    if (!ragResult || !ragResult.matched) return 0;
    
    // Score de base : confiance du match (longueur mot-clé / 10)
    let confidence = ragResult.confidence || 0.5;
    
    // Bonus si le mot-clé est long (plus précis)
    if (ragResult.matchedKeyword && ragResult.matchedKeyword.length > 5) {
        confidence += 0.1;
        console.log(`📊 [Confiance] Bonus mot-clé long: +10%`);
    }
    
    // Bonus pour les cas critiques (priorité 1 = urgence vitale)
    if (ragResult.data && ragResult.data.priority === 1) {
        confidence += 0.15;
        console.log(`📊 [Confiance] Bonus priorité critique: +15%`);
    }
    
    // Pénalité si le message est trop court (manque d'information)
    if (userMessage && userMessage.length < 10) {
        confidence -= 0.1;
        console.log(`📊 [Confiance] Pénalité message court: -10%`);
    }
    
    // Plafonner entre 0 et 1
    const finalConfidence = Math.min(Math.max(confidence, 0), 1);
    console.log(`📊 [Confiance] Score final RAG: ${Math.round(finalConfidence * 100)}%`);
    return finalConfidence;
}

/**
 * Calcule le score de confiance d'une réponse Groq
 * @param {Object} extractedInfo - Informations extraites par Groq
 * @param {number} retryCount - Nombre de tentatives
 * @returns {number} Score entre 0 et 1
 */
function calculateGroqConfidence(extractedInfo, retryCount = 0) {
    // Score de base
    let confidence = 0.7;
    console.log(`📊 [Confiance] Score base Groq: 70%`);
    
    // Moins de confiance après retry (plus on a essayé, moins on est sûr)
    if (retryCount > 0) {
        confidence -= retryCount * 0.1;
        console.log(`📊 [Confiance] Pénalité retry ${retryCount}: -${retryCount * 10}%`);
    }
    
    // Plus de confiance si plusieurs champs extraits (plus d'informations = plus fiable)
    const extractedFields = Object.values(extractedInfo || {}).filter(v => v !== null && v !== undefined && v !== '').length;
    if (extractedFields >= 3) {
        confidence += 0.1;
        console.log(`📊 [Confiance] Bonus ${extractedFields} champs extraits: +10%`);
    }
    if (extractedFields >= 5) {
        confidence += 0.1;
        console.log(`📊 [Confiance] Bonus ${extractedFields} champs extraits: +10%`);
    }
    
    // Plafonner entre 0 et 1
    const finalConfidence = Math.min(Math.max(confidence, 0), 1);
    console.log(`📊 [Confiance] Score final Groq: ${Math.round(finalConfidence * 100)}%`);
    return finalConfidence;
}

/**
 * Calcule le score de confiance global (combinaison RAG + Groq)
 * @param {Object} ragResult - Résultat RAG
 * @param {Object} groqResult - Résultat Groq
 * @returns {number}
 */
function calculateGlobalConfidence(ragResult, groqResult) {
    let ragScore = ragResult?.matched ? (ragResult.confidence || 0.5) : 0;
    let groqScore = groqResult?.confidence || 0.5;
    
    // Si RAG a matché, on lui donne plus de poids (source fiable)
    if (ragResult?.matched) {
        const globalConfidence = Math.min(ragScore + 0.1, 1);
        console.log(`📊 [Confiance] Score global (RAG prioritaire): ${Math.round(globalConfidence * 100)}%`);
        return globalConfidence;
    }
    
    const globalConfidence = (ragScore + groqScore) / 2;
    console.log(`📊 [Confiance] Score global (moyenne): ${Math.round(globalConfidence * 100)}%`);
    return globalConfidence;
}

/**
 * Vérifie si l'escalade humaine est nécessaire
 * @param {number} confidence - Score de confiance
 * @param {boolean} isCritical - Situation critique ?
 * @returns {boolean}
 */
function isHumanEscalationNeeded(confidence, isCritical = false) {
    const THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.6;
    
    // RÈGLE IMPORTANTE : escalade UNIQUEMENT si situation critique ET confiance faible
    // Pas d'escalade pour les cas non critiques, même si confiance faible
    if (isCritical && confidence < THRESHOLD) {
        console.log(`🚨 [Confiance] Escalade nécessaire: critique=${isCritical}, confiance=${Math.round(confidence*100)}% < seuil=${THRESHOLD*100}%`);
        return true;
    }
    
    console.log(`✅ [Confiance] Pas d'escalade: critique=${isCritical}, confiance=${Math.round(confidence*100)}%`);
    return false;
}

module.exports = {
    calculateRAGConfidence,
    calculateGroqConfidence,
    calculateGlobalConfidence,
    isHumanEscalationNeeded
};