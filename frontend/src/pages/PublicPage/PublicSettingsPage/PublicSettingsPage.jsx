// frontend/src/pages/PublicSettingsPage/PublicSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import useTranslation from '../../../hooks/useTranslation';
import './PublicSettingsPage.css';

const PublicSettingsPage = () => {
  const { language, t } = useTranslation();
  const T = t('settings');

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

  useEffect(() => {
    loadSettings();
    checkNotificationPermission();
    applySavedTheme(); // ✅ Appliquer le thème au chargement
  }, []);

  // ✅ Appliquer le thème sauvegardé au chargement de la page
  const applySavedTheme = () => {
    const savedSettings = localStorage.getItem('medassist_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.theme) {
          applyTheme(parsed.theme);
        }
      } catch (e) {
        console.error('Erreur chargement thème:', e);
      }
    }
  };

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('medassist_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
        // ✅ Appliquer immédiatement les paramètres chargés
        if (parsed.theme) applyTheme(parsed.theme);
        if (parsed.fontSize) applyFontSize(parsed.fontSize);
        if (parsed.language) applyLanguage(parsed.language);
        if (parsed.reducedAnimations) applyReducedAnimations(parsed.reducedAnimations);
        if (parsed.compactMode) applyCompactMode(parsed.compactMode);
        if (parsed.readingMode) applyReadingMode(parsed.readingMode);
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

  const saveSettings = () => {
    setLoading(true);
    localStorage.setItem('medassist_settings', JSON.stringify(settings));
    applyAllSettings();
    setTimeout(() => {
      setSaveStatus({ message: T.savedSuccess, type: 'success' });
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

  const applyLanguage = (lang) => {
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
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
    console.log('🎨 Application du thème:', theme);
    
    // ✅ Supprimer toutes les classes de thème existantes
    document.body.classList.remove('dark-mode', 'light-mode', 'auto-mode');
    
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      // ✅ Appliquer aussi au localStorage pour persistance
      localStorage.setItem('theme', 'dark');
    } else if (theme === 'light') {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.add('auto-mode');
      localStorage.setItem('theme', 'auto');
      // Détection automatique selon le système
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.add('light-mode');
      }
    }
    
    // ✅ Dispatch un événement pour que les autres composants réagissent
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: theme } }));
  };

  const applyFontSize = (size) => {
    const sizes = { small: '13px', medium: '16px', large: '19px', xlarge: '22px' };
    const fontSize = sizes[size] || '16px';
    document.documentElement.style.fontSize = fontSize;
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
    document.body.classList.toggle('reading-mode', reading);
  };

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // ✅ Application immédiate sans attendre la sauvegarde
    if (key === 'language') applyLanguage(value);
    if (key === 'theme') applyTheme(value);
    if (key === 'fontSize') applyFontSize(value);
    if (key === 'reducedAnimations') applyReducedAnimations(value);
    if (key === 'compactMode') applyCompactMode(value);
    if (key === 'readingMode') applyReadingMode(value);
    if (key === 'notifications') requestNotificationPermission(value);
  };

  const requestNotificationPermission = async (enabled) => {
    if (!enabled || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') showTestNotification();
    } else if (Notification.permission === 'granted') {
      showTestNotification();
    }
  };

  const showTestNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('🔔 MedAssist', {
        body: T.notifGranted,
        icon: '/favicon.ico',
      });
    }
  };

  const testNotification = () => {
    if (Notification.permission === 'granted') {
      showTestNotification();
      setSaveStatus({ message: T.notifSent, type: 'info' });
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 2000);
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') showTestNotification();
      });
    } else {
      setSaveStatus({ message: T.notifBlocked, type: 'error' });
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
    }
  };

  const handleReset = () => {
    const defaultSettings = {
      language: 'fr', theme: 'light', notifications: true,
      reducedAnimations: false, compactMode: false, fontSize: 'medium', readingMode: false,
    };
    setSettings(defaultSettings);
    localStorage.setItem('medassist_settings', JSON.stringify(defaultSettings));
    localStorage.setItem('theme', 'light');
    applyLanguage('fr');
    applyTheme('light');
    applyFontSize('medium');
    applyReducedAnimations(false);
    applyCompactMode(false);
    applyReadingMode(false);
    setSaveStatus({ message: T.resetSuccess, type: 'info' });
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'medassist_settings.json');
    link.click();
    setSaveStatus({ message: T.exportSuccess, type: 'success' });
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 2000);
  };

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
        setSaveStatus({ message: T.importSuccess, type: 'success' });
      } catch {
        setSaveStatus({ message: T.importError, type: 'error' });
      }
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <PublicLayout>
      <div className="settings-page">
        <div className="settings-header">
          <div className="header-icon">⚙️</div>
          <h1>{T.title}</h1>
          <p>{T.subtitle}</p>
        </div>

        <div className="settings-container">
          <div className="settings-card">

            {/* Langue */}
            <div className="settings-section">
              <div className="section-icon">🌐</div>
              <div className="section-content">
                <h3>{T.language}</h3>
                <p>{T.languageDesc}</p>
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

            {/* Thème - Dark mode fonctionnel */}
            <div className="settings-section">
              <div className="section-icon">🎨</div>
              <div className="section-content">
                <h3>{T.appearance}</h3>
                <p>{T.appearanceDesc}</p>
                <div className="settings-options">
                  {[
                    { value: 'light', label: T.themes.light, icon: '☀️' },
                    { value: 'dark', label: T.themes.dark, icon: '🌙' },
                    { value: 'auto', label: T.themes.auto, icon: '🔄' }
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

            {/* Taille texte */}
            <div className="settings-section">
              <div className="section-icon">🔤</div>
              <div className="section-content">
                <h3>{T.fontSize}</h3>
                <p>{T.fontSizeDesc}</p>
                <div className="settings-options">
                  {[
                    { value: 'small', label: T.fontSizes.small, px: '12px' },
                    { value: 'medium', label: T.fontSizes.medium, px: '16px' },
                    { value: 'large', label: T.fontSizes.large, px: '20px' },
                    { value: 'xlarge', label: T.fontSizes.xlarge, px: '24px' }
                  ].map(size => (
                    <button
                      key={size.value}
                      className={`option-btn ${settings.fontSize === size.value ? 'active' : ''}`}
                      onClick={() => updateSetting('fontSize', size.value)}
                    >
                      <span style={{ fontSize: size.px }}>A</span>
                      <span>{size.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Préférences d'affichage */}
            <div className="settings-section">
              <div className="section-icon">🖥️</div>
              <div className="section-content">
                <h3>{T.displayPrefs}</h3>
                <p>{T.displayPrefsDesc}</p>
                <div className="toggle-group">
                  {[
                    { key: 'reducedAnimations', icon: '🎬', label: T.reduceAnimations, desc: T.reduceAnimationsDesc },
                    { key: 'compactMode', icon: '📦', label: T.compactMode, desc: T.compactModeDesc },
                    { key: 'readingMode', icon: '📖', label: T.readingMode, desc: T.readingModeDesc },
                  ].map(({ key, icon, label, desc }) => (
                    <label className="toggle-label" key={key}>
                      <div className="toggle-info">
                        <span>{icon} {label}</span>
                        <small>{desc}</small>
                      </div>
                      <div className="toggle">
                        <input
                          type="checkbox"
                          checked={settings[key]}
                          onChange={(e) => updateSetting(key, e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="settings-section">
              <div className="section-icon">🔔</div>
              <div className="section-content">
                <h3>{T.notifications}</h3>
                <p>{T.notificationsDesc}</p>
                <label className="toggle-label">
                  <div className="toggle-info">
                    <span>{T.enableNotifications}</span>
                    <small>
                      {notificationPermission === 'granted' && T.notifGranted}
                      {notificationPermission === 'denied' && T.notifDenied}
                      {notificationPermission === 'default' && T.notifDefault}
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
                    {T.testNotif}
                  </button>
                )}
                {notificationPermission === 'denied' && (
                  <div className="notification-warning">{T.notifWarning}</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="settings-actions">
              <button className="btn-save" onClick={saveSettings} disabled={loading}>
                {loading ? T.saving : T.save}
              </button>
              <button className="btn-reset" onClick={handleReset}>{T.reset}</button>
              <button className="btn-export" onClick={exportSettings}>{T.export}</button>
              <label className="btn-import">
                {T.import}
                <input type="file" accept=".json" onChange={importSettings} style={{ display: 'none' }} />
              </label>
            </div>

            {saveStatus.message && (
              <div className={`save-status ${saveStatus.type}`}>{saveStatus.message}</div>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="settings-info">
          {[
            { icon: '💾', title: T.localSave, desc: T.localSaveDesc },
            { icon: '🔄', title: T.sync, desc: T.syncDesc },
            { icon: '🛡️', title: T.privacy, desc: T.privacyDesc },
          ].map(({ icon, title, desc }) => (
            <div className="info-card" key={title}>
              <span>{icon}</span>
              <div><strong>{title}</strong><p>{desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
};

export default PublicSettingsPage;