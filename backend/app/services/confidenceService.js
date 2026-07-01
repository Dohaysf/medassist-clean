/**
 * Calcule un score de confiance basé sur la réponse finale du chat Groq.
 * Le RAG sert de bonus, mais la base du score reste la qualité de la réponse.
 *
 * @param {Object} params
 * @param {string} params.groqResponse - Réponse finale générée par Groq
 * @param {string} params.userMessage - Message utilisateur original
 * @param {Object} params.ragResult - Résultat RAG optionnel
 * @param {Object} params.extractedInfo - Informations extraites par Groq
 * @returns {Object} Score entre 0 et 1 + détails
 */
function calculateChatConfidence({
    groqResponse,
    userMessage,
    ragResult = null,
    extractedInfo = null
}) {
    let confidence = 0;

    if (!groqResponse || groqResponse.trim() === '') {
        return {
            score: 0,
            level: 'unverified',
            label: '⚠️ Réponse vide',
            details: {
                groqFunctional: false,
                answerRelevant: false,
                ragBonus: 0
            }
        };
    }

    confidence = 0.45;

    let groqFunctional = true;
    let answerRelevant = false;
    let ragBonus = 0;

    const response = groqResponse.trim();
    const responseLower = response.toLowerCase();
    const userLower = (userMessage || '').toLowerCase();

    if (response.length >= 20) {
        confidence += 0.10;
    }

    if (response.length >= 60) {
        confidence += 0.05;
    }

    if (userLower.length > 0) {
        const userTokens = userLower.split(/\s+/).filter(t => t.length >= 4).slice(0, 5);
        let overlap = 0;

        for (const token of userTokens) {
            if (responseLower.includes(token)) {
                overlap++;
            }
        }

        if (overlap >= 1) {
            answerRelevant = true;
            confidence += 0.15;
        }

        if (overlap >= 2) {
            confidence += 0.05;
        }
    }

    if (response.includes('?') || response.includes('؟')) {
        confidence -= 0.05;
    }

    if (
        responseLower.includes('je ne sais pas') ||
        responseLower.includes("je n'ai pas") ||
        responseLower.includes('désolé') ||
        responseLower.includes('non disponible') ||
        responseLower.includes('impossible')
    ) {
        confidence -= 0.20;
    }

    if (extractedInfo) {
        const extractedFields = Object.values(extractedInfo).filter(v => v !== null && v !== undefined && v !== '').length;

        if (extractedFields >= 3) {
            confidence += 0.05;
        }

        if (extractedFields >= 5) {
            confidence += 0.05;
        }
    }

    if (ragResult && ragResult.matched) {
        if (ragResult.confidence >= 0.60) {
            ragBonus = 0.10;
        } else if (ragResult.confidence >= 0.30) {
            ragBonus = 0.05;
        } else {
            ragBonus = -0.05;
        }

        confidence += ragBonus;
    }

    confidence = Math.min(Math.max(confidence, 0), 1);

    let level = 'unverified';
    let label = '⚠️ Confiance faible';

    if (confidence >= 0.60) {
        level = 'verified';
        label = `✅ Réponse fiable (${Math.round(confidence * 100)}%)`;
    } else if (confidence >= 0.30) {
        level = 'partial';
        label = `⚠️ Réponse partielle (${Math.round(confidence * 100)}%)`;
    }

    return {
        score: confidence,
        level,
        label,
        details: {
            groqFunctional,
            answerRelevant,
            ragBonus
        }
    };
}

/**
 * Ancienne API conservée pour compatibilité si besoin.
 * @param {Object} ragResult
 * @param {string} userMessage
 * @returns {number}
 */
function calculateRAGConfidence(ragResult, userMessage) {
    if (!ragResult || !ragResult.matched) return 0;

    let confidence = ragResult.confidence || 0.5;

    if (ragResult.matchedKeyword && ragResult.matchedKeyword.length > 5) {
        confidence += 0.1;
    }

    if (ragResult.data && ragResult.data.priority === 1) {
        confidence += 0.15;
    }

    if (userMessage && userMessage.length < 10) {
        confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
}

function calculateGroqConfidence(extractedInfo, retryCount = 0) {
    let confidence = 0.7;

    if (retryCount > 0) {
        confidence -= retryCount * 0.1;
    }

    const extractedFields = Object.values(extractedInfo || {}).filter(v => v !== null && v !== undefined && v !== '').length;

    if (extractedFields >= 3) {
        confidence += 0.1;
    }

    if (extractedFields >= 5) {
        confidence += 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
}

function calculateGlobalConfidence(ragResult, groqResult) {
    let ragScore = 0;
    let groqScore = 0.5;

    if (ragResult && ragResult.matched) {
        ragScore = ragResult.confidence || 0.5;
    }

    if (groqResult && groqResult.confidence !== undefined) {
        groqScore = groqResult.confidence;
    } else if (groqResult && groqResult.score !== undefined) {
        groqScore = groqResult.score;
    }

    if (ragResult && ragResult.matched) {
        const globalConfidence = Math.min(ragScore + 0.1, 1);
        return globalConfidence;
    }

    return (ragScore + groqScore) / 2;
}

function isHumanEscalationNeeded(confidence, isCritical = false) {
    const THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6');

    if (isCritical && confidence < THRESHOLD) {
        return true;
    }

    return false;
}

module.exports = {
    calculateChatConfidence,
    calculateRAGConfidence,
    calculateGroqConfidence,
    calculateGlobalConfidence,
    isHumanEscalationNeeded
};