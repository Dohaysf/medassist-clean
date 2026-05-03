const mongoose = require('mongoose');
require('dotenv').config();
const Conversation = require('./app/models/Conversation'); // Assure-toi que le chemin est correct

async function testMongo() {
  console.log('URI =', process.env.MONGO_URI);

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connexion réussie !');

    // Test d'une opération findOneAndUpdate
    const sessionId = 'test-session-' + Date.now();
    console.log('Tentative de findOneAndUpdate...');
    const result = await Conversation.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: { sender: 'user', text: 'Message test' } },
        $set: { esoSummary: { test: true } }
      },
      { upsert: true, new: true }
    );
    console.log('✅ findOneAndUpdate réussi, ID du document :', result._id);

    // Vérifie que le message a bien été ajouté
    const conv = await Conversation.findOne({ sessionId });
    console.log('Messages :', conv.messages.length);

  } catch (err) {
    console.error('❌ Erreur :', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

testMongo();