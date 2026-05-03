const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, age, address, gender, phone, medicalHistory } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe trop court' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    // 🔐 sécurité : empêcher création manager
    const safeRole = role === 'manager' ? 'patient' : role;

    const user = new User({
      email,
      password,
      name,
      role: safeRole || 'patient',
      age,
      address,
      gender,
      phone,
      medicalHistory: medicalHistory || { diabete: false, asthme: false, tension: false, other: '' }
    });

    await user.save();

    res.status(201).json({
      message: 'Compte créé avec succès'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const isValid = await user.comparePassword(password);

    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les infos de l'utilisateur connecté
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;