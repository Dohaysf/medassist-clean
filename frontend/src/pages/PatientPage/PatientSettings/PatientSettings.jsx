// frontend/src/pages/PatientPage/PatientSettings/PatientSettings.jsx
import React, { useState, useEffect } from 'react';
import translations from '../../../translation';
import './PatientSettings.css';

const PatientSettings = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  const t = (translations[lang] || translations.fr).settings;
  const isRTL = lang === 'ar';

  const [settings, setSettings] = useState({
    language: lang,
    theme: 'light',
    notifications: true,
    reducedAnimations: false,
    compactMode: false,
    fontSize: 'medium',
    readingMode: false,
    soundEffects: true,
  });

  const [saveStatus, setSaveStatus]               = useState({ message: '', type: '' });
  const [loading, setLoading]                     = useState(false);
  const [notificationPermission, setNotifPerm]    = useState('default');

  useEffect(() => {
    const saved = localStorage.getItem('patientSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
        if (parsed.language) setLang(parsed.language);
      } catch (e) { console.error(e); }
    }
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  useEffect(() => { setLang(settings.language); }, [settings.language]);

  // ── Apply functions ──────────────────────────────────────────────────────

  const applyLanguage = (l) => {
    localStorage.setItem('language', l);
    document.documentElement.lang = l;
    if (l === 'ar') {
      document.body.style.direction = 'rtl';
      document.body.classList.add('rtl-mode');
    } else {
      document.body.style.direction = 'ltr';
      document.body.classList.remove('rtl-mode');
    }
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { language: l } }));
  };

  const applyTheme = (theme) => {
    // Unified class names: dark-mode / light-mode / auto-mode
    document.body.classList.remove('dark-mode', 'light-mode', 'auto-mode');
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else if (theme === 'auto') {
      document.body.classList.add('auto-mode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.add(prefersDark ? 'dark-mode' : 'light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
     window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme } }));
  };

  const applyFontSize = (size) => {
    const map = { small: '13px', medium: '16px', large: '19px', xlarge: '22px' };
    document.documentElement.style.fontSize = map[size] || '16px';
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

  const applyAll = (s) => {
    applyLanguage(s.language);
    applyTheme(s.theme);
    applyFontSize(s.fontSize);
    applyReducedAnimations(s.reducedAnimations);
    applyCompactMode(s.compactMode);
    applyReadingMode(s.readingMode);
  };

  // ── Update ───────────────────────────────────────────────────────────────

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (key === 'language')          applyLanguage(value);
    if (key === 'theme')             applyTheme(value);
    if (key === 'fontSize')          applyFontSize(value);
    if (key === 'reducedAnimations') applyReducedAnimations(value);
    if (key === 'compactMode')       applyCompactMode(value);
    if (key === 'readingMode')       applyReadingMode(value);
    if (key === 'notifications')     requestNotifPermission(value);
  };

  const requestNotifPermission = async (enabled) => {
    if (!enabled || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm === 'granted') showTestNotif();
    } else if (Notification.permission === 'granted') {
      showTestNotif();
    }
  };

  const showTestNotif = () => {
    if (Notification.permission === 'granted') {
      new Notification('🔔 MedAssist', {
        body: 'Les notifications sont activées !',
        icon: '/favicon.ico',
      });
    }
  };

  const testNotification = () => {
    if (Notification.permission === 'granted') {
      showTestNotif();
      setSaveStatus({ message: t.notifSent, type: 'info' });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { if (p === 'granted') showTestNotif(); });
    } else {
      setSaveStatus({ message: t.notifBlocked, type: 'error' });
    }
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const saveSettings = () => {
    setLoading(true);
    localStorage.setItem('patientSettings', JSON.stringify(settings));
    applyAll(settings);
    setTimeout(() => {
      setSaveStatus({ message: t.savedSuccess, type: 'success' });
      setLoading(false);
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
    }, 300);
  };

  const handleReset = () => {
    const def = {
      language: 'fr', theme: 'light', notifications: true,
      reducedAnimations: false, compactMode: false,
      fontSize: 'medium', readingMode: false, soundEffects: true,
    };
    setSettings(def);
    localStorage.setItem('patientSettings', JSON.stringify(def));
    applyAll(def);
    setSaveStatus({ message: t.resetSuccess, type: 'info' });
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
  };

  const exportSettings = () => {
    const uri = 'data:application/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(settings, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', uri);
    a.setAttribute('download', 'patient_settings.json');
    a.click();
    setSaveStatus({ message: t.exportSuccess, type: 'success' });
    setTimeout(() => setSaveStatus({ message: '', type: '' }), 2000);
  };

  const importSettings = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        const next = { ...settings, ...imported };
        setSettings(next);
        localStorage.setItem('patientSettings', JSON.stringify(next));
        applyAll(next);
        setSaveStatus({ message: t.importSuccess, type: 'success' });
      } catch {
        setSaveStatus({ message: t.importError, type: 'error' });
      }
      setTimeout(() => setSaveStatus({ message: '', type: '' }), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Data ─────────────────────────────────────────────────────────────────

  const languages = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'ar', label: 'العربية',  flag: '🇲🇦' },
    { value: 'en', label: 'English',  flag: '🇬🇧' },
  ];

  const themes = [
    { value: 'light', label: t.themes.light, icon: '☀️' },
    { value: 'dark',  label: t.themes.dark,  icon: '🌙' },
    { value: 'auto',  label: t.themes.auto,  icon: '🔄' },
  ];

  const fontSizes = [
    { value: 'small',  label: t.fontSizes.small,  px: '12px' },
    { value: 'medium', label: t.fontSizes.medium, px: '16px' },
    { value: 'large',  label: t.fontSizes.large,  px: '20px' },
    { value: 'xlarge', label: t.fontSizes.xlarge, px: '24px' },
  ];

  const toggleItems = [
    { key: 'reducedAnimations', icon: '🎬', label: t.reduceAnimations, desc: t.reduceAnimationsDesc },
    { key: 'compactMode',       icon: '📦', label: t.compactMode,       desc: t.compactModeDesc },
    { key: 'readingMode',       icon: '📖', label: t.readingMode,       desc: t.readingModeDesc },
    { key: 'soundEffects',      icon: '🔊', label: t.soundEffects,      desc: t.soundEffectsDesc },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`patient-settings-page${isRTL ? ' rtl' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="patient-settings-header">
        <div className="header-icon">⚙️</div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>

      <div className="patient-settings-container">
        <div className="patient-settings-card">

          {/* ── Langue ── */}
          <div className="settings-section">
            <div className="section-icon">🌐</div>
            <div className="section-content">
              <h3>{t.language}</h3>
              <p>{t.languageDesc}</p>
              <div className="settings-options">
                {languages.map(l => (
                  <button
                    key={l.value}
                    className={`option-btn${settings.language === l.value ? ' active' : ''}`}
                    onClick={() => updateSetting('language', l.value)}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Thème ── */}
          <div className="settings-section">
            <div className="section-icon">🎨</div>
            <div className="section-content">
              <h3>{t.appearance}</h3>
              <p>{t.appearanceDesc}</p>
              <div className="settings-options">
                {themes.map(th => (
                  <button
                    key={th.value}
                    className={`option-btn${settings.theme === th.value ? ' active' : ''}`}
                    onClick={() => updateSetting('theme', th.value)}
                  >
                    <span>{th.icon}</span>
                    <span>{th.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Taille du texte ── */}
          <div className="settings-section">
            <div className="section-icon">🔤</div>
            <div className="section-content">
              <h3>{t.fontSize}</h3>
              <p>{t.fontSizeDesc}</p>
              <div className="settings-options">
                {fontSizes.map(fs => (
                  <button
                    key={fs.value}
                    className={`option-btn${settings.fontSize === fs.value ? ' active' : ''}`}
                    onClick={() => updateSetting('fontSize', fs.value)}
                  >
                    <span style={{ fontSize: fs.px }}>A</span>
                    <span>{fs.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Préférences d'affichage ── */}
          <div className="settings-section">
            <div className="section-icon">🖥️</div>
            <div className="section-content">
              <h3>{t.displayPrefs}</h3>
              <p>{t.displayPrefsDesc}</p>
              <div className="toggle-group">
                {toggleItems.map(item => (
                  <label key={item.key} className="toggle-label">
                    <div className="toggle-info">
                      <span>{item.icon} {item.label}</span>
                      <small>{item.desc}</small>
                    </div>
                    <div className="toggle">
                      <input
                        type="checkbox"
                        checked={settings[item.key]}
                        onChange={e => updateSetting(item.key, e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Notifications ── */}
          <div className="settings-section">
            <div className="section-icon">🔔</div>
            <div className="section-content">
              <h3>{t.notifications}</h3>
              <p>{t.notificationsDesc}</p>
              <label className="toggle-label">
                <div className="toggle-info">
                  <span>{t.enableNotifications}</span>
                  <small>
                    {notificationPermission === 'granted' && t.notifGranted}
                    {notificationPermission === 'denied'  && t.notifDenied}
                    {notificationPermission === 'default' && t.notifDefault}
                  </small>
                </div>
                <div className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={e => updateSetting('notifications', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </div>
              </label>
              {settings.notifications && notificationPermission !== 'denied' && (
                <button className="test-notif-btn" onClick={testNotification}>
                  {t.testNotif}
                </button>
              )}
              {notificationPermission === 'denied' && (
                <div className="notification-warning">{t.notifWarning}</div>
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="settings-actions">
            <button className="btn-save" onClick={saveSettings} disabled={loading}>
              {loading ? t.saving : t.save}
            </button>
            <button className="btn-reset"  onClick={handleReset}>{t.reset}</button>
            <button className="btn-export" onClick={exportSettings}>{t.export}</button>
            <label className="btn-import">
              {t.import}
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

      {/* Infos */}
      <div className="patient-settings-info">
        <div className="info-card">
          <span>💾</span>
          <div><strong>{t.localSave}</strong><p>{t.localSaveDesc}</p></div>
        </div>
        <div className="info-card">
          <span>🔄</span>
          <div><strong>{t.sync}</strong><p>{t.syncDesc}</p></div>
        </div>
        <div className="info-card">
          <span>🛡️</span>
          <div><strong>{t.privacy}</strong><p>{t.privacyDesc}</p></div>
        </div>
      </div>
    </div>
  );
};

export default PatientSettings;