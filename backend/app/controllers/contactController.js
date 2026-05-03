const Contact = require('../models/Contact');

// Public : envoyer un message
exports.sendContactMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    const newMessage = await Contact.create({ name, email, message });
    res.status(201).json({ success: true, message: 'Message envoyé' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Admin : récupérer tous les messages
exports.getAllContacts = async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Erreur récupération' });
  }
};

// Admin : supprimer un message
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Contact.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Message non trouvé' });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
};