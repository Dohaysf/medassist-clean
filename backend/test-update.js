const mongoose = require('mongoose');
require('dotenv').config();
const Conversation = require('./app/models/Conversation');

async function testUpdate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connexion MongoDB établie');

    const sessionId = 'test-update-' + Date.now();
    console.log('Session ID :', sessionId);

    // Premier upsert (création)
    const result = await Conversation.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: { sender: 'user', text: 'Premier message' } },
        $set: { esoSummary: { step: 1 } }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Premier upsert réussi, ID :', result._id);
    console.log('Messages après premier :', result.messages.length);

    // Deuxième upsert (mise à jour)
    const result2 = await Conversation.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: { sender: 'bot', text: 'Réponse' } },
        $set: { esoSummary: { step: 2 } }
      },
      { upsert: true, new: true }
    );
    console.log('✅ Deuxième upsert réussi, messages :', result2.messages.length);
    console.log('Résumé ESO :', result2.esoSummary);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Déconnecté');
  }
}

testUpdate();