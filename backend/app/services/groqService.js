// backend/app/services/groqService.js
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function callGroq(prompt) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Tu es un assistant médical pré-hospitalier. Tu poses des questions pour collecter des informations sur les symptômes du patient. Tu es concis et professionnel. Ne donne jamais de diagnostic."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 500
    });
    return chatCompletion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";
  } catch (error) {
    console.error('❌ Erreur Groq:', error.message);
    return "Désolé, le service d'IA est momentanément indisponible.";
  }
}

module.exports = { callGroq };