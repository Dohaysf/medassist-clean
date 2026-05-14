// frontend/src/pages/PatientPage/PatientSettings/PatientSettings.jsx
import React, { useState, useEffect } from 'react';
import { FaBell, FaLanguage, FaMoon, FaSun, FaGlobe, FaVolumeUp, FaPalette } from 'react-icons/fa';
import './PatientSettings.css';

const PatientSettings = () => {
    const [settings, setSettings] = useState({
        language: 'fr',
        theme: 'light',
        notifications: true,
        soundEffects: true,
        fontSize: 'medium'
    });

    useEffect(() => {
        const saved = localStorage.getItem('patientSettings');
        if (saved) {
            setSettings(JSON.parse(saved));
        }
    }, []);

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        localStorage.setItem('patientSettings', JSON.stringify(newSettings));
        
        // Appliquer les changements immédiatement
        if (key === 'theme') {
            document.body.className = value === 'dark' ? 'dark-theme' : 'light-theme';
            localStorage.setItem('theme', value);
        }
        if (key === 'language') {
            localStorage.setItem('language', value);
            window.dispatchEvent(new Event('languageChange'));
        }
    };

    return (
        <div className="patient-settings-page">
            <div className="patient-settings-header">
                <h1>⚙️ Paramètres</h1>
                <p>Personnalisez votre expérience MedAssist</p>
            </div>

            <div className="patient-settings-grid">
                {/* Langue */}
                <div className="patient-settings-card">
                    <div className="card-icon"><FaLanguage /></div>
                    <h3>Langue</h3>
                    <div className="toggle-group">
                        <button 
                            className={settings.language === 'fr' ? 'active' : ''}
                            onClick={() => updateSetting('language', 'fr')}
                        >
                            🇫🇷 Français
                        </button>
                        <button 
                            className={settings.language === 'ar' ? 'active' : ''}
                            onClick={() => updateSetting('language', 'ar')}
                        >
                            🇲🇦 العربية
                        </button>
                        <button 
                            className={settings.language === 'en' ? 'active' : ''}
                            onClick={() => updateSetting('language', 'en')}
                        >
                            🇬🇧 English
                        </button>
                    </div>
                </div>

                {/* Thème */}
                <div className="patient-settings-card">
                    <div className="card-icon"><FaPalette /></div>
                    <h3>Apparence</h3>
                    <div className="toggle-group">
                        <button 
                            className={settings.theme === 'light' ? 'active' : ''}
                            onClick={() => updateSetting('theme', 'light')}
                        >
                            <FaSun /> Clair
                        </button>
                        <button 
                            className={settings.theme === 'dark' ? 'active' : ''}
                            onClick={() => updateSetting('theme', 'dark')}
                        >
                            <FaMoon /> Sombre
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="patient-settings-card">
                    <div className="card-icon"><FaBell /></div>
                    <h3>Notifications</h3>
                    <label className="toggle-label">
                        <span>Recevoir des alertes</span>
                        <div className="switch">
                            <input 
                                type="checkbox" 
                                checked={settings.notifications}
                                onChange={(e) => updateSetting('notifications', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </div>
                    </label>
                </div>

                {/* Sons */}
                <div className="patient-settings-card">
                    <div className="card-icon"><FaVolumeUp /></div>
                    <h3>Effets sonores</h3>
                    <label className="toggle-label">
                        <span>Activer les sons</span>
                        <div className="switch">
                            <input 
                                type="checkbox" 
                                checked={settings.soundEffects}
                                onChange={(e) => updateSetting('soundEffects', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </div>
                    </label>
                </div>
            </div>

            <div className="patient-settings-footer">
                <p>MedAssist © 2026 - Vos données sont en sécurité</p>
            </div>
        </div>
    );
};

export default PatientSettings;