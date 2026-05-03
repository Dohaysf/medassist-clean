import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 🏥 maladies
  const [diabete, setDiabete] = useState(false);
  const [asthme, setAsthme] = useState(false);
  const [tension, setTension] = useState(false);
  const [otherDisease, setOtherDisease] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.includes('@')) return setError('Email invalide');
    if (password.length < 6) return setError('Mot de passe trop court');
    if (password !== confirmPassword) return setError('Les mots de passe ne correspondent pas');

    try {
      await axios.post('http://localhost:5000/api/auth/register', {
        name,
        email,
        age,
        gender,
        phone,
        password,
        role: 'patient',
        medicalHistory: {
          diabete,
          asthme,
          tension,
          other: otherDisease
        }
      });

      setSuccess('Compte créé avec succès');
      setTimeout(() => navigate('/login'), 1500);

    } catch (err) {
      setError(err.response?.data?.error || 'Erreur serveur');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <h2>Créer un compte</h2>
        <p className="subtitle">Espace patient sécurisé</p>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Infos perso */}
          <div className="form-section">
            <span className="section-title">Informations personnelles</span>
            <input placeholder="Nom complet" value={name} onChange={e => setName(e.target.value)} />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />

            <div className="row">
              <input type="number" placeholder="Âge" value={age} onChange={e => setAge(e.target.value)} />
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Sexe</option>
                <option value="homme">Homme</option>
                <option value="femme">Femme</option>
              </select>
            </div>

            <input placeholder="Téléphone" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          {/* Sécurité */}
          <div className="form-section">
            <span className="section-title">Sécurité</span>
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
            <input type="password" placeholder="Confirmer mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>

          {/* Maladies */}
          <div className="form-section">
            <span className="section-title">Antécédents médicaux</span>
            <div className="checkbox-group">
              <label><input type="checkbox" checked={diabete} onChange={() => setDiabete(!diabete)} /> Diabète</label>
              <label><input type="checkbox" checked={asthme} onChange={() => setAsthme(!asthme)} /> Asthme</label>
              <label><input type="checkbox" checked={tension} onChange={() => setTension(!tension)} /> Tension</label>
            </div>
            <input
              type="text"
              placeholder="Autre maladie (optionnel)"
              value={otherDisease}
              onChange={e => setOtherDisease(e.target.value)}
            />
          </div>

          <button type="submit">Créer mon compte</button>
        </form>

        <p className="link">Déjà un compte ? <a href="/login">Se connecter</a></p>
      </div>
    </div>
  );
};

export default Register;