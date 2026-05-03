const express = require('express');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Contact = require('../models/Contact'); // ← Ajout
const router = express.Router();

// Statistiques publiques (non authentifiées)
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

// Route publique pour envoyer un message de contact (formulaire "À propos")
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