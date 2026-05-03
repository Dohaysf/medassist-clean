import React, { useState, useEffect } from 'react';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicSettingsPage.css';

const PublicSettingsPage = () => {
  // État pour les paramètres
  const [settings, setSettings] = useState({
    language: 'fr',
    theme: 'light',
    notifications: true,
    autoLocation: false,
    fontSize: 'medium',
    readingMode: false,
  });

  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Charger les paramètres sauvegardés
  useEffect(() => {
    const savedSettings = localStorage.getItem('publicSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Appliquer la langue
  useEffect(() => {
    localStorage.setItem('language', settings.language);
    // Déclencher un événement pour que les autres composants réagissent
    window.dispatchEvent(new Event('languageChange'));
  }, [settings.language]);

  // Appliquer le thème
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else if (settings.theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      // Auto - détecter le système
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
      } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
      }
    }
  }, [settings.theme]);

  // Appliquer la taille de police
  useEffect(() => {
    const root = document.documentElement;
    if (settings.fontSize === 'small') {
      root.style.fontSize = '14px';
    } else if (settings.fontSize === 'medium') {
      root.style.fontSize = '16px';
    } else if (settings.fontSize === 'large') {
      root.style.fontSize = '18px';
    }
    localStorage.setItem('fontSize', settings.fontSize);
  }, [settings.fontSize]);

  // Appliquer le mode lecture
  useEffect(() => {
    if (settings.readingMode) {
      document.body.classList.add('reading-mode');
    } else {
      document.body.classList.remove('reading-mode');
    }
  }, [settings.readingMode]);

  // Appliquer les notifications
  useEffect(() => {
    if (settings.notifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [settings.notifications]);

  // Sauvegarder les paramètres
  const handleSave = () => {
    setLoading(true);
    localStorage.setItem('publicSettings', JSON.stringify(settings));
    
    // Appliquer immédiatement les changements
    applyLanguage(settings.language);
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);
    
    setTimeout(() => {
      setSaveStatus('✅ Paramètres sauvegardés avec succès !');
      setLoading(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }, 500);
  };

  // Fonctions d'application immédiate
  const applyLanguage = (lang) => {
    localStorage.setItem('language', lang);
    window.dispatchEvent(new Event('languageChange'));
    
    // Mettre à jour les textes de l'interface si nécessaire
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      // Ici vous pouvez implémenter votre système de traduction
    });
  };

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else if (theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
      } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
      }
    }
  };

  const applyFontSize = (size) => {
    const root = document.documentElement;
    if (size === 'small') {
      root.style.fontSize = '14px';
    } else if (size === 'medium') {
      root.style.fontSize = '16px';
    } else if (size === 'large') {
      root.style.fontSize = '18px';
    }
  };

  // Réinitialiser les paramètres
  const handleReset = () => {
    const defaultSettings = {
      language: 'fr',
      theme: 'light',
      notifications: true,
      autoLocation: false,
      fontSize: 'medium',
      readingMode: false,
    };
    setSettings(defaultSettings);
    localStorage.setItem('publicSettings', JSON.stringify(defaultSettings));
    
    // Appliquer les valeurs par défaut
    applyLanguage('fr');
    applyTheme('light');
    applyFontSize('medium');
    document.body.classList.remove('reading-mode');
    
    setSaveStatus('🔄 Paramètres réinitialisés');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Mettre à jour un paramètre
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Application immédiate pour certains paramètres
    if (key === 'language') {
      applyLanguage(value);
    }
    if (key === 'theme') {
      applyTheme(value);
    }
    if (key === 'fontSize') {
      applyFontSize(value);
    }
    if (key === 'readingMode') {
      if (value) {
        document.body.classList.add('reading-mode');
      } else {
        document.body.classList.remove('reading-mode');
      }
    }
    if (key === 'autoLocation') {
      if (value) {
        // Demander la permission de géolocalisation
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              localStorage.setItem('userLocation', JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              }));
              setSaveStatus('📍 Localisation enregistrée');
              setTimeout(() => setSaveStatus(''), 2000);
            },
            () => {
              setSaveStatus('❌ Impossible d\'accéder à votre position');
              setTimeout(() => setSaveStatus(''), 2000);
            }
          );
        }
      }
    }
  };

  // Tester une notification
  const testNotification = () => {
    if (settings.notifications && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('MedAssist', {
          body: '🔔 Les notifications sont activées !',
          icon: '/favicon.ico'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('MedAssist', {
              body: '🔔 Les notifications sont activées !',
              icon: '/favicon.ico'
            });
          }
        });
      }
    }
  };

  return (
    <PublicLayout>
      <div className="settings-page">
        <div className="settings-header">
          <h1>⚙️ Paramètres</h1>
          <p>Personnalisez votre expérience sur MedAssist</p>
        </div>

        <div className="settings-container">
          <div className="settings-card">
            {/* Section Langue */}
            <div className="settings-section">
              <div className="section-icon">🌐</div>
              <div className="section-content">
                <h3>Langue</h3>
                <p>Choisissez votre langue préférée pour l'interface et les réponses</p>
                <div className="settings-options">
                  <label className={`option-btn ${settings.language === 'fr' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="language"
                      value="fr"
                      checked={settings.language === 'fr'}
                      onChange={(e) => updateSetting('language', e.target.value)}
                    />
                    <span>🇫🇷 Français</span>
                  </label>
                  <label className={`option-btn ${settings.language === 'ar' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="language"
                      value="ar"
                      checked={settings.language === 'ar'}
                      onChange={(e) => updateSetting('language', e.target.value)}
                    />
                    <span>🇲🇦 العربية</span>
                  </label>
                  <label className={`option-btn ${settings.language === 'en' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="language"
                      value="en"
                      checked={settings.language === 'en'}
                      onChange={(e) => updateSetting('language', e.target.value)}
                    />
                    <span>🇬🇧 English</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section Thème */}
            <div className="settings-section">
              <div className="section-icon">🎨</div>
              <div className="section-content">
                <h3>Thème</h3>
                <p>Choisissez l'apparence de l'application</p>
                <div className="settings-options">
                  <label className={`option-btn ${settings.theme === 'light' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={settings.theme === 'light'}
                      onChange={(e) => updateSetting('theme', e.target.value)}
                    />
                    <span>☀️ Clair</span>
                  </label>
                  <label className={`option-btn ${settings.theme === 'dark' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={settings.theme === 'dark'}
                      onChange={(e) => updateSetting('theme', e.target.value)}
                    />
                    <span>🌙 Sombre</span>
                  </label>
                  <label className={`option-btn ${settings.theme === 'auto' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value="auto"
                      checked={settings.theme === 'auto'}
                      onChange={(e) => updateSetting('theme', e.target.value)}
                    />
                    <span>🔄 Auto (système)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section Taille de police */}
            <div className="settings-section">
              <div className="section-icon">🔤</div>
              <div className="section-content">
                <h3>Taille du texte</h3>
                <p>Ajustez la taille du texte pour une meilleure lisibilité</p>
                <div className="settings-options">
                  <label className={`option-btn ${settings.fontSize === 'small' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="fontSize"
                      value="small"
                      checked={settings.fontSize === 'small'}
                      onChange={(e) => updateSetting('fontSize', e.target.value)}
                    />
                    <span>Petit</span>
                  </label>
                  <label className={`option-btn ${settings.fontSize === 'medium' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="fontSize"
                      value="medium"
                      checked={settings.fontSize === 'medium'}
                      onChange={(e) => updateSetting('fontSize', e.target.value)}
                    />
                    <span>Moyen</span>
                  </label>
                  <label className={`option-btn ${settings.fontSize === 'large' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="fontSize"
                      value="large"
                      checked={settings.fontSize === 'large'}
                      onChange={(e) => updateSetting('fontSize', e.target.value)}
                    />
                    <span>Grand</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section Notifications */}
            <div className="settings-section">
              <div className="section-icon">🔔</div>
              <div className="section-content">
                <h3>Notifications</h3>
                <p>Recevez des alertes importantes</p>
                <div className="toggle-switch">
                  <label className="toggle-label">
                    <span>Activer les notifications</span>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications}
                        onChange={(e) => updateSetting('notifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </div>
                  </label>
                </div>
                {settings.notifications && (
                  <button className="test-notif-btn" onClick={testNotification}>
                    🔔 Tester la notification
                  </button>
                )}
              </div>
            </div>

            {/* Section Localisation automatique */}
            <div className="settings-section">
              <div className="section-icon">📍</div>
              <div className="section-content">
                <h3>Localisation automatique</h3>
                <p>Partagez automatiquement votre position lors des consultations</p>
                <div className="toggle-switch">
                  <label className="toggle-label">
                    <span>Activer la géolocalisation auto</span>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.autoLocation}
                        onChange={(e) => updateSetting('autoLocation', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Section Mode lecture */}
            <div className="settings-section">
              <div className="section-icon">📖</div>
              <div className="section-content">
                <h3>Mode lecture</h3>
                <p>Optimise l'affichage pour une lecture confortable</p>
                <div className="toggle-switch">
                  <label className="toggle-label">
                    <span>Activer le mode lecture</span>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.readingMode}
                        onChange={(e) => updateSetting('readingMode', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Section Actions */}
            <div className="settings-actions">
              <button className="btn-save" onClick={handleSave} disabled={loading}>
                {loading ? '⏳ Sauvegarde...' : '💾 Sauvegarder les paramètres'}
              </button>
              <button className="btn-reset" onClick={handleReset}>
                🔄 Réinitialiser
              </button>
            </div>

            {saveStatus && <div className="save-status">{saveStatus}</div>}
          </div>
        </div>

        {/* Section Informations */}
        <div className="settings-info">
          <div className="info-card">
            <span>ℹ️</span>
            <div>
              <strong>Confidentialité</strong>
              <p>Vos paramètres sont sauvegardés localement sur votre navigateur.</p>
            </div>
          </div>
          <div className="info-card">
            <span>🛡️</span>
            <div>
              <strong>Données</strong>
              <p>Aucune donnée personnelle n'est stockée sur nos serveurs.</p>
            </div>
          </div>
          <div className="info-card">
            <span>🔄</span>
            <div>
              <strong>Synchronisation</strong>
              <p>Les paramètres sont synchronisés sur cet appareil uniquement.</p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default PublicSettingsPage;