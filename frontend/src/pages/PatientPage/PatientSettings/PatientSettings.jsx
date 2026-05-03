import React, { useState, useEffect } from 'react';
import { FaBell, FaPalette, FaGlobe, FaMicrophone, FaMoon, FaSun } from 'react-icons/fa';
import './PatientSettings.css';

const PatientSettings = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'fr');
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('voiceEnabled') !== 'false');
  const [notifications, setNotifications] = useState(true);

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

  return (
    <div className="patient-settings-page">
      <div className="patient-settings-header">
        <h1>⚙️ Paramètres</h1>
        <p>Personnalisez votre expérience</p>
      </div>

      <div className="patient-settings-grid">
        {/* Thème */}
        <div className="patient-settings-card">
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
        <div className="patient-settings-card">
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
        <div className="patient-settings-card">
          <div className="card-icon"><FaMicrophone /></div>
          <h3>Réponses vocales</h3>
          <label className="switch">
            <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">{voiceEnabled ? 'Activée' : 'Désactivée'}</span>
        </div>

        {/* Notifications */}
        <div className="patient-settings-card">
          <div className="card-icon"><FaBell /></div>
          <h3>Notifications</h3>
          <label className="switch">
            <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">{notifications ? 'Activées' : 'Désactivées'}</span>
        </div>
      </div>

      <div className="patient-settings-footer">
        <p>MedAssist – Application médicale pré-hospitalière</p>
      </div>
    </div>
  );
};

export default PatientSettings;