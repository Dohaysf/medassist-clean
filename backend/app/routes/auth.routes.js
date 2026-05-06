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
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (error) {
    console.error('Erreur GET /me:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ AJOUTER CETTE ROUTE - Mettre à jour le profil utilisateur
router.put('/update', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, email, phone, age, gender, medicalHistory } = req.body;

    console.log('📝 Mise à jour profil pour user:', userId);
    console.log('📝 Données reçues:', { name, email, phone, age, gender, medicalHistory });

    // Vérifier si l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }

    // Mise à jour des champs
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (medicalHistory !== undefined) updateData.medicalHistory = medicalHistory;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    console.log('✅ Profil mis à jour avec succès');

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ AJOUTER CETTE ROUTE - Changer le mot de passe
router.put('/change-password', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe actuel
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur changement mot de passe:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ AJOUTER CETTE ROUTE - Supprimer le compte (optionnel)
router.delete('/account', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await User.findByIdAndDelete(userId);
    
    res.json({
      success: true,
      message: 'Compte supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression compte:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;