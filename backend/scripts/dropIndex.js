const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medical_chatbot';

async function dropIndex() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
    
    const collection = mongoose.connection.collection('conversations');
    
    const indexes = await collection.indexes();
    console.log('\n📋 Index existants:');
    indexes.forEach(i => console.log(`   - ${i.name}: ${JSON.stringify(i.key)}`));
    
    const hasSessionIdIndex = indexes.some(i => i.name === 'sessionId_1');
    
    if (hasSessionIdIndex) {
      await collection.dropIndex('sessionId_1');
      console.log('\n✅ Index sessionId_1 supprimé avec succès');
    } else {
      console.log('\nℹ️ Index sessionId_1 n\'existe pas');
    }
    
    const remainingIndexes = await collection.indexes();
    console.log('\n📋 Index restants:');
    remainingIndexes.forEach(i => console.log(`   - ${i.name}: ${JSON.stringify(i.key)}`));
    
    await mongoose.disconnect();
    console.log('\n✅ Déconnecté de MongoDB');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

dropIndex();
