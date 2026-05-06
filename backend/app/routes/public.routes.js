const express = require('express');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Contact = require('../models/Contact');
const router = express.Router();

// Statistiques publiques
router.get('/stats', async (req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments();
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const criticalCount = await Conversation.countDocuments({ 'esoSummary.severity': 'critique' });
    const avgAge = await Conversation.aggregate([
      { $match: { 'esoSummary.age': { $exists: true } } },
      { $group: { _id: null, avgAge: { $avg: '$esoSummary.age' } } }
    ]);
    res.json({
      totalConversations,
      totalPatients,
      criticalCount,
      avgAge: avgAge.length > 0 ? Math.round(avgAge[0].avgAge) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ ROUTE CORRECTE POUR L'HISTORIQUE PUBLIC
router.get('/history', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    console.log('🔍 Session reçue:', sessionId);
    
    if (!sessionId) {
      return res.json([]);
    }
    
    // Chercher la conversation par sessionId OU tempUserId
    let conversation = await Conversation.findOne({ 
      $or: [
        { sessionId: sessionId },
        { tempUserId: sessionId }
      ]
    }).sort({ updatedAt: -1 });
    
    // Si pas trouvé, chercher la conversation la plus récente sans userId
    if (!conversation) {
      conversation = await Conversation.findOne({ 
        userId: null 
      }).sort({ updatedAt: -1 });
      
      if (conversation) {
        console.log('✅ Conversation récente trouvée:', conversation.sessionId);
      }
    }
    
    if (!conversation) {
      return res.json([]);
    }
    
    // Formater la réponse
    const firstUserMsg = conversation.messages?.find(m => m.sender === 'user');
    const lastBotMsg = conversation.messages?.filter(m => m.sender === 'bot').pop();
    
    const formatted = [{
      id: conversation._id,
      sessionId: conversation.sessionId,
      date: conversation.updatedAt || conversation.createdAt,
      title: conversation.title || firstUserMsg?.text?.substring(0, 50) || 'Consultation médicale',
      preview: lastBotMsg?.text?.substring(0, 120) || firstUserMsg?.text?.substring(0, 120) || '',
      messageCount: conversation.messages?.length || 0,
      urgency: lastBotMsg?.text?.includes('URGENCE') || conversation.esoSummary?.severity === 'critique'
    }];
    
    res.json(formatted);
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour le contact
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    const newMessage = await Contact.create({ name, email, message });
    res.status(201).json({ success: true, message: 'Message envoyé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;