// backend/app/services/groqService.js
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Modeles par ordre de priorite — si le premier est rate-limite, on passe au suivant
const FALLBACK_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
];

const SYSTEM_PROMPT = "Tu es un assistant medical pre-hospitalier. Tu poses des questions pour collecter des informations sur les symptomes du patient. Tu es concis et professionnel. Ne donne jamais de diagnostic.";

async function callGroq(prompt, options) {
    var temperature = (options && options.temperature) || 0.7;
    var max_tokens = (options && options.max_tokens) || 500;
    var systemPrompt = (options && options.systemPrompt) || SYSTEM_PROMPT;

    var lastError = null;

    for (var i = 0; i < FALLBACK_MODELS.length; i++) {
        var model = FALLBACK_MODELS[i];
        try {
            console.log('🤖 [GROQ] Tentative avec: ' + model);

            var chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                model: model,
                temperature: temperature,
                max_tokens: max_tokens
            });

            var choice = chatCompletion.choices && chatCompletion.choices[0];
            var content = (choice && choice.message && choice.message.content) || '';

            if (!content) {
                console.warn('⚠️ [GROQ] Reponse vide depuis ' + model);
                continue;
            }

            if (model !== FALLBACK_MODELS[0]) {
                console.log('✅ [GROQ] Succes avec modele de fallback: ' + model);
            }

            return content;

        } catch (error) {
            lastError = error;

            var status = (error && error.status) || (error && error.response && error.response.status);
            var isRateLimit = status === 429 ||
                (error.message && error.message.indexOf('rate_limit_exceeded') !== -1);

            if (isRateLimit) {
                var waitMatch = error.message && error.message.match(/try again in (\d+m[\d.]+s)/i);
                var waitInfo = waitMatch ? ' (retry: ' + waitMatch[1] + ')' : '';
                console.warn('⚠️ [GROQ] Rate limit sur ' + model + waitInfo + ' — passage au modele suivant');
                continue;
            }

            console.error('❌ [GROQ] Erreur non-recuperable sur ' + model + ':', error.message);
            break;
        }
    }

    console.error('❌ [GROQ] Tous les modeles ont echoue. Derniere erreur:', lastError && lastError.message);
    return null;
}

async function callGroqSafe(prompt, fallbackMessage, options) {
    var result = await callGroq(prompt, options);

    if (result !== null) return result;

    var lang = (options && options.lang) || 'fr';
    return fallbackMessage || (
        lang === 'ar' ?
        'Desole, service IA indisponible. Reessayez dans quelques minutes.' :
        "Desole, le service IA est momentanement indisponible. Veuillez reessayer dans quelques minutes."
    );
}

module.exports = { callGroq: callGroq, callGroqSafe: callGroqSafe };