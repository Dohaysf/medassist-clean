import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './PatientInfo.css';

const PatientInfo = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saveStatus, setSaveStatus] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      setFormData(res.data);
    } catch (err) {
      console.error(err);
      showMessage('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (message, type) => {
    setSaveStatus({ show: true, message, type });
    setTimeout(() => setSaveStatus({ show: false, message: '', type: '' }), 3000);
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showMessage('Vous devez être connecté', 'error');
      return;
    }

    try {
      const response = await axios.put('http://localhost:5000/api/auth/update', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        setEditing(false);
        showMessage('✅ Profil mis à jour avec succès !', 'success');
      }
    } catch (err) {
      console.error('Erreur save:', err);
      showMessage(err.response?.data?.error || '❌ Erreur lors de la mise à jour', 'error');
    }
  };

  const handleCancel = () => {
    setFormData(user);
    setEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="patient-info-page">
        <div className="loading-container">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-info-page">
      {/* Topbar */}
      <div className="info-topbar">
        <div className="topbar-left">
          <span className="topbar-icon">👤</span>
          <h1>Mon profil</h1>
          <span className="topbar-badge">{user?.role === 'patient' ? 'Patient' : 'Manager'}</span>
        </div>
        {!editing ? (
          <button className="edit-btn" onClick={() => setEditing(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3l4 4L7 21H3v-4L17 3z"/>
              <line x1="15" y1="5" x2="19" y2="9"/>
            </svg>
            Modifier
          </button>
        ) : (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSave}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Sauvegarder
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Toast message */}
      {saveStatus.show && (
        <div className={`toast-message ${saveStatus.type}`}>
          {saveStatus.message}
        </div>
      )}

      {/* Stats horizontales */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <span className="stat-value">Membre depuis</span>
            <span className="stat-label">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <span className="stat-value">Statut</span>
            <span className="stat-label">Actif</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🆔</div>
          <div className="stat-info">
            <span className="stat-value">ID Patient</span>
            <span className="stat-label">{user?._id?.slice(-8) || '—'}</span>
          </div>
        </div>
      </div>

      {/* Contenu principal 2 colonnes */}
      <div className="info-main">
        {/* Colonne gauche */}
        <div className="info-column">
          <div className="info-section">
            <div className="section-header">
              <span className="section-icon">📝</span>
              <h2>Informations personnelles</h2>
            </div>

            <div className="info-grid">
              <div className="info-field">
                <label>Nom complet</label>
                {editing ? (
                  <input 
                    name="name"
                    value={formData.name || ''} 
                    onChange={handleChange}
                    placeholder="Votre nom complet"
                  />
                ) : (
                  <p>{user?.name || '—'}</p>
                )}
              </div>

              <div className="info-field">
                <label>Email</label>
                {editing ? (
                  <input 
                    name="email"
                    type="email"
                    value={formData.email || ''} 
                    onChange={handleChange}
                    placeholder="votre@email.com"
                  />
                ) : (
                  <p>{user?.email || '—'}</p>
                )}
              </div>

              <div className="info-field">
                <label>Téléphone</label>
                {editing ? (
                  <input 
                    name="phone"
                    value={formData.phone || ''} 
                    onChange={handleChange}
                    placeholder="+212 6XX XXX XXX"
                  />
                ) : (
                  <p>{user?.phone || 'Non renseigné'}</p>
                )}
              </div>

              <div className="info-field">
                <label>Âge</label>
                {editing ? (
                  <input 
                    name="age"
                    type="number"
                    value={formData.age || ''} 
                    onChange={handleChange}
                    placeholder="Votre âge"
                  />
                ) : (
                  <p>{user?.age ? `${user.age} ans` : 'Non renseigné'}</p>
                )}
              </div>

              <div className="info-field">
                <label>Sexe</label>
                {editing ? (
                  <select 
                    name="gender"
                    value={formData.gender || ''} 
                    onChange={handleChange}
                  >
                    <option value="">Non précisé</option>
                    <option value="homme">Homme</option>
                    <option value="femme">Femme</option>
                  </select>
                ) : (
                  <p>
                    {user?.gender === 'homme' ? 'Homme' : 
                     user?.gender === 'femme' ? 'Femme' : 'Non renseigné'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="info-column">
          <div className="info-section">
            <div className="section-header">
              <span className="section-icon">🏥</span>
              <h2>Antécédents médicaux</h2>
            </div>

            <div className="medical-history">
              {user?.medicalHistory ? (
                <div className="history-grid">
                  <div className={`history-item ${user.medicalHistory.diabete ? 'active' : ''}`}>
                    <span className="history-icon">🩸</span>
                    <span>Diabète</span>
                    {user.medicalHistory.diabete && <span className="check">✓</span>}
                  </div>
                  <div className={`history-item ${user.medicalHistory.asthme ? 'active' : ''}`}>
                    <span className="history-icon">🌬️</span>
                    <span>Asthme</span>
                    {user.medicalHistory.asthme && <span className="check">✓</span>}
                  </div>
                  <div className={`history-item ${user.medicalHistory.tension ? 'active' : ''}`}>
                    <span className="history-icon">❤️</span>
                    <span>Hypertension</span>
                    {user.medicalHistory.tension && <span className="check">✓</span>}
                  </div>
                  {user.medicalHistory.other && (
                    <div className="history-item active">
                      <span className="history-icon">📝</span>
                      <span>{user.medicalHistory.other}</span>
                      <span className="check">✓</span>
                    </div>
                  )}
                  {!user.medicalHistory.diabete && !user.medicalHistory.asthme && !user.medicalHistory.tension && !user.medicalHistory.other && (
                    <div className="history-item empty">
                      <span className="history-icon">✅</span>
                      <span>Aucun antécédent déclaré</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="history-empty">
                  <span>📭</span>
                  <p>Aucun antécédent médical</p>
                </div>
              )}
            </div>

            {/* Carte conseil */}
            <div className="advice-card">
              <div className="advice-icon">💡</div>
              <div className="advice-content">
                <h4>Conseil de santé</h4>
                <p>Gardez vos informations médicales à jour pour une meilleure prise en charge.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientInfo;