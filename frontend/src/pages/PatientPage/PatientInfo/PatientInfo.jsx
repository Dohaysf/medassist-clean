// frontend/src/pages/PatientPage/PatientInfo/PatientInfo.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import translations from '../../../translation'; // ← à adapter selon ton projet
import './PatientInfo.css';

const PatientInfo = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  // Récupération sécurisée des traductions pour cette page
  const pageTranslations = (translations[lang] || translations.fr)?.patientInfo || {};
  // Fallback pour éviter les undefined
  const t = (key) => pageTranslations[key] || key;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saveStatus, setSaveStatus] = useState({ show: false, message: '', type: '' });

  // Écoute les changements de langue
  useEffect(() => {
    const handleLangChange = (e) => {
      if (e.detail && e.detail.language) {
        setLang(e.detail.language);
      } else if (localStorage.getItem('language')) {
        setLang(localStorage.getItem('language'));
      }
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

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
      showMessage(t('loadError') || 'Erreur lors du chargement', 'error');
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
      showMessage(t('notLoggedIn') || 'Vous devez être connecté', 'error');
      return;
    }

    try {
      const response = await axios.put('http://localhost:5000/api/auth/update', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        setEditing(false);
        showMessage(t('updateSuccess') || 'Profil mis à jour !', 'success');
      }
    } catch (err) {
      console.error('Erreur save:', err);
      showMessage(err.response?.data?.error || t('updateError') || 'Erreur lors de la mise à jour', 'error');
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
          <h1>{t('title') || 'Mon profil'}</h1>
          <span className="topbar-badge">{user?.role === 'patient' ? (t('patient') || 'Patient') : (t('manager') || 'Manager')}</span>
        </div>
        {!editing ? (
          <button className="edit-btn" onClick={() => setEditing(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3l4 4L7 21H3v-4L17 3z"/>
              <line x1="15" y1="5" x2="19" y2="9"/>
            </svg>
            {t('edit') || 'Modifier'}
          </button>
        ) : (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSave}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {t('save') || 'Sauvegarder'}
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              {t('cancel') || 'Annuler'}
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
            <span className="stat-value">{t('memberSince') || 'Membre depuis'}</span>
            <span className="stat-label">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <span className="stat-value">{t('status') || 'Statut'}</span>
            <span className="stat-label">{t('active') || 'Actif'}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🆔</div>
          <div className="stat-info">
            <span className="stat-value">{t('patientId') || 'ID Patient'}</span>
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
              <h2>{t('personalInfo') || 'Informations personnelles'}</h2>
            </div>

            <div className="info-grid">
              <div className="info-field">
                <label>{t('fullName') || 'Nom complet'}</label>
                {editing ? (
                  <input 
                    name="name"
                    value={formData.name || ''} 
                    onChange={handleChange}
                    placeholder={t('fullNamePlaceholder') || 'Votre nom complet'}
                  />
                ) : (
                  <p>{user?.name || '—'}</p>
                )}
              </div>

              <div className="info-field">
                <label>{t('email') || 'Email'}</label>
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
                <label>{t('phone') || 'Téléphone'}</label>
                {editing ? (
                  <input 
                    name="phone"
                    value={formData.phone || ''} 
                    onChange={handleChange}
                    placeholder={t('phonePlaceholder') || '+212 6XX XXX XXX'}
                  />
                ) : (
                  <p>{user?.phone || t('notProvided') || 'Non renseigné'}</p>
                )}
              </div>

              <div className="info-field">
                <label>{t('age') || 'Âge'}</label>
                {editing ? (
                  <input 
                    name="age"
                    type="number"
                    value={formData.age || ''} 
                    onChange={handleChange}
                    placeholder={t('agePlaceholder') || 'Votre âge'}
                  />
                ) : (
                  <p>{user?.age ? `${user.age} ${t('years') || 'ans'}` : t('notProvided') || 'Non renseigné'}</p>
                )}
              </div>

              <div className="info-field">
                <label>{t('gender') || 'Sexe'}</label>
                {editing ? (
                  <select 
                    name="gender"
                    value={formData.gender || ''} 
                    onChange={handleChange}
                  >
                    <option value="">{t('notSpecified') || 'Non précisé'}</option>
                    <option value="homme">{t('male') || 'Homme'}</option>
                    <option value="femme">{t('female') || 'Femme'}</option>
                  </select>
                ) : (
                  <p>
                    {user?.gender === 'homme' ? (t('male') || 'Homme') : 
                     user?.gender === 'femme' ? (t('female') || 'Femme') : (t('notSpecified') || 'Non précisé')}
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
              <h2>{t('medicalHistory') || 'Antécédents médicaux'}</h2>
            </div>

            <div className="medical-history">
              {user?.medicalHistory ? (
                <div className="history-grid">
                  <div className={`history-item ${user.medicalHistory.diabete ? 'active' : ''}`}>
                    <span className="history-icon">🩸</span>
                    <span>{t('diabetes') || 'Diabète'}</span>
                    {user.medicalHistory.diabete && <span className="check">✓</span>}
                  </div>
                  <div className={`history-item ${user.medicalHistory.asthme ? 'active' : ''}`}>
                    <span className="history-icon">🌬️</span>
                    <span>{t('asthma') || 'Asthme'}</span>
                    {user.medicalHistory.asthme && <span className="check">✓</span>}
                  </div>
                  <div className={`history-item ${user.medicalHistory.tension ? 'active' : ''}`}>
                    <span className="history-icon">❤️</span>
                    <span>{t('hypertension') || 'Hypertension'}</span>
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
                      <span>{t('noHistory') || 'Aucun antécédent déclaré'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="history-empty">
                  <span>📭</span>
                  <p>{t('noHistoryData') || 'Aucun antécédent médical'}</p>
                </div>
              )}
            </div>

            {/* Carte conseil */}
            <div className="advice-card">
              <div className="advice-icon">💡</div>
              <div className="advice-content">
                <h4>{t('healthTipTitle') || 'Conseil de santé'}</h4>
                <p>{t('healthTipText') || 'Gardez vos informations médicales à jour pour une meilleure prise en charge.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientInfo;