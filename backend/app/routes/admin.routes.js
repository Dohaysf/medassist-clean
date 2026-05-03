const express = require('express');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact'); // ← Ajout
const auth = require('../middleware/auth');
const router = express.Router();

const isManager = (req, res, next) => {
  if (!req.user || req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Accès refusé (manager uniquement)' });
  }
  next();
};

// Liste des patients
router.get('/users', auth, isManager, async (req, res) => {
  try {
    const users = await User.find({ role: 'patient' }, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Statistiques globales
router.get('/stats', auth, isManager, async (req, res) => {
  try {
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalConversations = await Conversation.countDocuments();
    const severityCount = await Conversation.aggregate([
      { $group: { _id: '$esoSummary.severity', count: { $sum: 1 } } }
    ]);
    res.json({ totalPatients, totalConversations, severityCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Conversations d'un patient donné
router.get('/conversations/:userId', auth, isManager, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === NOUVELLES ROUTES POUR LES MESSAGES DE CONTACT ===
// Récupérer tous les messages (admin)
router.get('/contacts', auth, isManager, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un message
router.delete('/contacts/:id', auth, isManager, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Contact.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    res.json({ success: true, message: 'Message supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;