import React, { useState, useEffect } from 'react';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicSettingsPage.css';

const PublicSettingsPage = () => {
  // État pour les paramètres
  const [settings, setSettings] = useState({
    language: 'fr',
    theme: 'light',
    notifications: true,
    reducedAnimations: false,
    compactMode: false,
    fontSize: 'medium',
    readingMode: false,
  });

  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');

  // Charger les paramètres sauvegardés
  useEffect(() => {
    loadSettings();
    checkNotificationPermission();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('medassist_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Erreur chargement settings:', e);
      }
    }
  };

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  // Sauvegarder les paramètres
  const saveSettings = () => {
    setLoading(true);
    localStorage.setItem('medassist_settings', JSON.stringify(settings));
    
    // Appliquer tous les paramètres
    applyAllSettings();
    
    setTimeout(() => {
      setSaveStatus({ 
        message: '✅ Paramètres sauvegardés avec succès !', 
        type: 'success' 
      });
      setLoading(false);
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
    }, 300);
  };

  const applyAllSettings = () => {
    applyLanguage(settings.language);
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);
    applyReducedAnimations(settings.reducedAnimations);
    applyCompactMode(settings.compactMode);
    applyReadingMode(settings.readingMode);
  };

  // Application des paramètres
  const applyLanguage = (lang) => {
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'fr';
    
    // Appliquer la direction RTL pour l'arabe
    if (lang === 'ar') {
      document.body.style.direction = 'rtl';
      document.body.classList.add('rtl-mode');
    } else {
      document.body.style.direction = 'ltr';
      document.body.classList.remove('rtl-mode');
    }
    
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { language: lang } }));
  };

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode', 'auto-mode');
    } else if (theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode', 'auto-mode');
    } else {
      document.body.classList.add('auto-mode');
      document.body.classList.remove('dark-mode', 'light-mode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.add('light-mode');
      }
    }
  };

  const applyFontSize = (size) => {
    const sizes = { small: '13px', medium: '16px', large: '19px', xlarge: '22px' };
    document.documentElement.style.fontSize = sizes[size] || '16px';
    localStorage.setItem('fontSize', size);
  };

  const applyReducedAnimations = (reduced) => {
    if (reduced) {
      document.body.classList.add('reduced-motion');
      document.documentElement.style.setProperty('--transition-duration', '0.01s');
    } else {
      document.body.classList.remove('reduced-motion');
      document.documentElement.style.setProperty('--transition-duration', '0.2s');
    }
  };

  const applyCompactMode = (compact) => {
    if (compact) {
      document.body.classList.add('compact-mode');
      document.documentElement.style.setProperty('--spacing-unit', '0.75rem');
    } else {
      document.body.classList.remove('compact-mode');
      document.documentElement.style.setProperty('--spacing-unit', '1rem');
    }
  };

  const applyReadingMode = (reading) => {
    if (reading) {
      document.body.classList.add('reading-mode');
    } else {
      document.body.classList.remove('reading-mode');
    }
  };

  // Mettre à jour un paramètre
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Application immédiate
    if (key === 'language') applyLanguage(value);
    if (key === 'theme') applyTheme(value);
    if (key === 'fontSize') applyFontSize(value);
    if (key === 'reducedAnimations') applyReducedAnimations(value);
    if (key === 'compactMode') applyCompactMode(value);
    if (key === 'readingMode') applyReadingMode(value);
    if (key === 'notifications') requestNotificationPermission(value);
  };

  // Demander permission notification
  const requestNotificationPermission = async (enabled) => {
    if (!enabled) return;
    
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          showTestNotification();
        }
      } else if (Notification.permission === 'granted') {
        showTestNotification();
      }
    }
  };

  const showTestNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('🔔 MedAssist', {
        body: 'Les notifications sont activées ! Vous recevrez les alertes importantes.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        silent: false
      });
    }
  };

  const testNotification = () => {
    if (Notification.permission === 'granted') {
      showTestNotification();
      setSaveStatus({ message: '🔔 Notification envoyée !', type: 'info' });
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 2000);
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showTestNotification();
        }
      });
    } else {
      setSaveStatus({ message: '❌ Notifications bloquées. Activez-les dans les paramètres de votre navigateur.', type: 'error' });
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
    }
  };

  // Réinitialiser les paramètres
  const handleReset = () => {
    const defaultSettings = {
      language: 'fr',
      theme: 'light',
      notifications: true,
      reducedAnimations: false,
      compactMode: false,
      fontSize: 'medium',
      readingMode: false,
    };
    setSettings(defaultSettings);
    localStorage.setItem('medassist_settings', JSON.stringify(defaultSettings));
    
    // Appliquer les valeurs par défaut
    applyLanguage('fr');
    applyTheme('light');
    applyFontSize('medium');
    applyReducedAnimations(false);
    applyCompactMode(false);
    applyReadingMode(false);
    
    setSaveStatus({ message: '🔄 Paramètres réinitialisés aux valeurs par défaut', type: 'info' });
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
  };

  // Exporter les paramètres
  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'medassist_settings.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    setSaveStatus({ message: '📥 Paramètres exportés avec succès', type: 'success' });
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 2000);
  };

  // Importer les paramètres
  const importSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const newSettings = { ...settings, ...imported };
        setSettings(newSettings);
        localStorage.setItem('medassist_settings', JSON.stringify(newSettings));
        applyAllSettings();
        
        setSaveStatus({ message: '📤 Paramètres importés avec succès', type: 'success' });
        setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
      } catch (err) {
        setSaveStatus({ message: '❌ Fichier invalide', type: 'error' });
        setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <PublicLayout>
      <div className="settings-page">
        <div className="settings-header">
          <div className="header-icon">⚙️</div>
          <h1>Paramètres</h1>
          <p>Personnalisez votre expérience MedAssist</p>
        </div>

        <div className="settings-container">
          <div className="settings-card">
            {/* Section Langue */}
            <div className="settings-section">
              <div className="section-icon">🌐</div>
              <div className="section-content">
                <h3>Langue d'affichage</h3>
                <p>Choisissez votre langue préférée pour l'interface</p>
                <div className="settings-options">
                  {[
                    { value: 'fr', label: 'Français', flag: '🇫🇷' },
                    { value: 'ar', label: 'العربية', flag: '🇲🇦' },
                    { value: 'en', label: 'English', flag: '🇬🇧' }
                  ].map(lang => (
                    <button
                      key={lang.value}
                      className={`option-btn ${settings.language === lang.value ? 'active' : ''}`}
                      onClick={() => updateSetting('language', lang.value)}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section Thème */}
            <div className="settings-section">
              <div className="section-icon">🎨</div>
              <div className="section-content">
                <h3>Apparence</h3>
                <p>Personnalisez le thème de l'application</p>
                <div className="settings-options">
                  {[
                    { value: 'light', label: 'Clair', icon: '☀️' },
                    { value: 'dark', label: 'Sombre', icon: '🌙' },
                    { value: 'auto', label: 'Auto (système)', icon: '🔄' }
                  ].map(theme => (
                    <button
                      key={theme.value}
                      className={`option-btn ${settings.theme === theme.value ? 'active' : ''}`}
                      onClick={() => updateSetting('theme', theme.value)}
                    >
                      <span>{theme.icon}</span>
                      <span>{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section Taille de texte */}
            <div className="settings-section">
              <div className="section-icon">🔤</div>
              <div className="section-content">
                <h3>Taille du texte</h3>
                <p>Ajustez pour une meilleure lisibilité</p>
                <div className="settings-options">
                  {[
                    { value: 'small', label: 'Petit', example: 'A' },
                    { value: 'medium', label: 'Moyen', example: 'A' },
                    { value: 'large', label: 'Grand', example: 'A' },
                    { value: 'xlarge', label: 'Très grand', example: 'A' }
                  ].map(size => (
                    <button
                      key={size.value}
                      className={`option-btn ${settings.fontSize === size.value ? 'active' : ''}`}
                      onClick={() => updateSetting('fontSize', size.value)}
                    >
                      <span style={{ fontSize: size.value === 'small' ? '12px' : size.value === 'medium' ? '16px' : size.value === 'large' ? '20px' : '24px' }}>
                        {size.example}
                      </span>
                      <span>{size.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section Préférences d'affichage */}
            <div className="settings-section">
              <div className="section-icon">🖥️</div>
              <div className="section-content">
                <h3>Préférences d'affichage</h3>
                <p>Optimisez l'interface selon vos besoins</p>
                
                <div className="toggle-group">
                  <label className="toggle-label">
                    <div className="toggle-info">
                      <span>🎬 Réduire les animations</span>
                      <small>Utile pour économiser la batterie ou réduire les mouvements</small>
                    </div>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.reducedAnimations}
                        onChange={(e) => updateSetting('reducedAnimations', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </div>
                  </label>

                  <label className="toggle-label">
                    <div className="toggle-info">
                      <span>📦 Mode compact</span>
                      <small>Afficher plus de contenu à l'écran</small>
                    </div>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.compactMode}
                        onChange={(e) => updateSetting('compactMode', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </div>
                  </label>

                  <label className="toggle-label">
                    <div className="toggle-info">
                      <span>📖 Mode lecture</span>
                      <small>Optimisation pour la lecture prolongée</small>
                    </div>
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

            {/* Section Notifications */}
            <div className="settings-section">
              <div className="section-icon">🔔</div>
              <div className="section-content">
                <h3>Notifications</h3>
                <p>Recevez des alertes importantes</p>
                
                <label className="toggle-label">
                  <div className="toggle-info">
                    <span>Activer les notifications</span>
                    <small>
                      {notificationPermission === 'granted' && '✓ Notifications autorisées'}
                      {notificationPermission === 'denied' && '⚠️ Notifications bloquées par le navigateur'}
                      {notificationPermission === 'default' && 'Activez pour recevoir des alertes'}
                    </small>
                  </div>
                  <div className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.notifications}
                      onChange={(e) => updateSetting('notifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                
                {settings.notifications && notificationPermission !== 'denied' && (
                  <button className="test-notif-btn" onClick={testNotification}>
                    🔔 Tester la notification
                  </button>
                )}
                
                {notificationPermission === 'denied' && (
                  <div className="notification-warning">
                    ⚠️ Les notifications sont bloquées. Activez-les dans les paramètres de votre navigateur.
                  </div>
                )}
              </div>
            </div>

            {/* Section Actions */}
            <div className="settings-actions">
              <button className="btn-save" onClick={saveSettings} disabled={loading}>
                {loading ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
              </button>
              <button className="btn-reset" onClick={handleReset}>
                🔄 Réinitialiser
              </button>
              <button className="btn-export" onClick={exportSettings}>
                📥 Exporter
              </button>
              <label className="btn-import">
                📤 Importer
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {saveStatus.message && (
              <div className={`save-status ${saveStatus.type}`}>
                {saveStatus.message}
              </div>
            )}
          </div>
        </div>

        {/* Section Informations */}
        <div className="settings-info">
          <div className="info-card">
            <span>💾</span>
            <div>
              <strong>Sauvegarde locale</strong>
              <p>Vos paramètres sont stockés sur votre navigateur uniquement</p>
            </div>
          </div>
          <div className="info-card">
            <span>🔄</span>
            <div>
              <strong>Synchronisation</strong>
              <p>Les paramètres sont liés à ce navigateur uniquement</p>
            </div>
          </div>
          <div className="info-card">
            <span>🛡️</span>
            <div>
              <strong>Confidentialité</strong>
              <p>Aucune donnée n'est envoyée à nos serveurs</p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default PublicSettingsPage;