import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaBell, FaPalette, FaGlobe, FaMicrophone, FaTrashAlt, FaMoon, FaSun, FaCheckCircle } from 'react-icons/fa';
import './SettingsPage.css';

const SettingsPage = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'fr');
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('voiceEnabled') !== 'false');
  const [notifications, setNotifications] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('voiceEnabled', voiceEnabled);
  }, [voiceEnabled]);

  const handleClearHistory = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir effacer tout l’historique des conversations ?')) {
      setClearing(true);
      try {
        await axios.delete('http://localhost:5000/api/eso/clear');
        setClearSuccess(true);
        setTimeout(() => setClearSuccess(false), 3000);
      } catch (error) {
        console.error('Erreur lors de l’effacement', error);
        alert('Erreur lors de l’effacement');
      } finally {
        setClearing(false);
      }
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>⚙️ Paramètres</h1>
        <p>Personnalisez votre expérience</p>
      </div>

      <div className="settings-grid">
        {/* Thème */}
        <div className="settings-card">
          <div className="card-icon"><FaPalette /></div>
          <h3>Apparence</h3>
          <div className="toggle-group">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
              <FaSun /> Clair
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
              <FaMoon /> Sombre
            </button>
          </div>
        </div>

        {/* Langue */}
        <div className="settings-card">
          <div className="card-icon"><FaGlobe /></div>
          <h3>Langue</h3>
          <div className="toggle-group">
            <button className={language === 'fr' ? 'active' : ''} onClick={() => setLanguage('fr')}>
              🇫🇷 Français
            </button>
            <button className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>
              🇲🇦 العربية
            </button>
          </div>
        </div>

        {/* Voix */}
        <div className="settings-card">
          <div className="card-icon"><FaMicrophone /></div>
          <h3>Réponses vocales</h3>
          <label className="switch">
            <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">{voiceEnabled ? 'Activée' : 'Désactivée'}</span>
        </div>

        {/* Notifications */}
        <div className="settings-card">
          <div className="card-icon"><FaBell /></div>
          <h3>Notifications</h3>
          <label className="switch">
            <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">{notifications ? 'Activées' : 'Désactivées'}</span>
        </div>

        {/* Données */}
        <div className="settings-card">
          <div className="card-icon"><FaTrashAlt /></div>
          <h3>Historique</h3>
          <button className="danger-btn" onClick={handleClearHistory} disabled={clearing}>
            {clearing ? 'Effacement...' : 'Effacer toutes les conversations'}
          </button>
          {clearSuccess && <div className="success-message"><FaCheckCircle /> Historique effacé !</div>}
        </div>
      </div>

      <div className="settings-footer">
        <p>MedAssist – Application médicale pré-hospitalière</p>
      </div>
    </div>
  );
};

export default SettingsPage;