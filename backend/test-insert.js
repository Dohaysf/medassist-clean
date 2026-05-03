const mongoose = require('mongoose');
require('dotenv').config();
const Conversation = require('./app/models/Conversation');

async function testModel() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connexion MongoDB établie');

    const sessionId = 'test-' + Date.now();
    console.log('Tentative de création avec sessionId :', sessionId);

    // Création d'une nouvelle conversation
    const conv = new Conversation({
      sessionId,
      messages: [{ sender: 'user', text: 'Message test' }],
      esoSummary: { test: true }
    });

    await conv.save();
    console.log('✅ Conversation sauvegardée avec succès, ID :', conv._id);

    // Recherche par sessionId
    const found = await Conversation.findOne({ sessionId });
    console.log('🔍 Conversation retrouvée :', found ? found._id : 'non trouvée');
  } catch (err) {
    console.error('❌ Erreur :', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Déconnecté');
  }
}

testModel();