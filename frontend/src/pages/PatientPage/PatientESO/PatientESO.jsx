import React, { useEffect, useState } from 'react';
import axios from 'axios';
import translations from '../../../translation';
import './PatientESO.css';

const PatientESO = () => {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');

  // ── Langue (même pattern que PatientHistory) ─────────────
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  const t = (translations[lang] || translations.fr).eso;
  const isRTL = lang === 'ar';

  useEffect(() => {
    const handleLangChange = (e) => {
      const newLang = e.detail?.language || localStorage.getItem('language') || 'fr';
      setLang(newLang);
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  // ── Thème (même pattern que languageChange) ──────────────
  const [theme, setTheme] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('patientSettings'));
      if (saved?.theme) return saved.theme;
    } catch {}
    if (document.body.classList.contains('dark-mode')) return 'dark';
    return 'light';
  });

  useEffect(() => {
    const handleThemeChange = (e) => {
      const t = e.detail?.theme || 'light';
      // résoudre "auto" tout de suite
      if (t === 'auto') {
        setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      } else {
        setTheme(t);
      }
    };
    window.addEventListener('themeChange', handleThemeChange);
    return () => window.removeEventListener('themeChange', handleThemeChange);
  }, []);

  // thème résolu (au cas où la valeur initiale serait "auto")
  const resolvedTheme = theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  // ── Data ─────────────────────────────────────────────────
  useEffect(() => {
    fetchESO();
  }, []);

  const fetchESO = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:5000/api/patient/eso', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResumes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const getSeverityClass = (severity) => {
    if (!severity) return 'severity-normal';
    switch (severity.toLowerCase()) {
      case 'critique': return 'severity-critical';
      case 'urgent':   return 'severity-urgent';
      case 'modere':   return 'severity-moderate';
      default:         return 'severity-normal';
    }
  };

  const getSeverityLabel = (severity) => {
    if (!severity) return t.severities?.normal || 'Normal';
    const labels = {
      'critique': t.severities?.critique || '⚠️ Critique',
      'urgent':   t.severities?.urgent   || '🔴 Urgent',
      'modere':   t.severities?.modere   || '🟡 Modéré',
      'leger':    t.severities?.leger    || '🟢 Léger',
    };
    return labels[severity.toLowerCase()] || severity;
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const now  = new Date();
      const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      if (days === 0) return t.today     || "Aujourd'hui";
      if (days === 1) return t.yesterday || "Hier";
      if (days < 7)  return `${t.daysAgo || "Il y a"} ${days} ${t.days || "jours"}`;
      return date.toLocaleDateString(
        lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR',
        { day: 'numeric', month: 'long', year: 'numeric' }
      );
    } catch { return dateStr; }
  };

  const filteredResumes = filter === 'all'
    ? resumes
    : resumes.filter(r => r.esoSummary?.severity?.toLowerCase() === filter);

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`patient-eso-page ${resolvedTheme}-mode`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="eso-loading">
          <div className="loading-dots"><span></span><span></span><span></span></div>
          <p>{t.loading || "Chargement de vos résumés médicaux..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`patient-eso-page ${resolvedTheme}-mode`} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Topbar ── */}
      <div className="eso-topbar">
        <div className="topbar-left">
          <span className="topbar-icon">📊</span>
          <h1>{t.title || "Mes résumés ESO"}</h1>
        </div>
        <button className="refresh-btn" onClick={fetchESO}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {t.refresh || "Actualiser"}
        </button>
      </div>

      <div className="eso-container">

        {/* ── Filtres ── */}
        {resumes.length > 0 && (
          <div className="eso-filters">
            {[
              { key: 'all',      label: `${t.filterAll || "Tous"} (${resumes.length})` },
              { key: 'critique', label: t.filterCritical || "⚠️ Critique" },
              { key: 'urgent',   label: t.filterUrgent   || "🔴 Urgent" },
            ].map(f => (
              <button
                key={f.key}
                className={`filter-btn ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {filteredResumes.length === 0 ? (
          <div className="eso-empty">
            <div className="empty-icon">📋</div>
            <h3>{t.noESO || "Aucun résumé ESO"}</h3>
            <p>{t.noESODesc || "Vos résumés médicaux apparaîtront ici après vos consultations."}</p>
            <button className="empty-start-btn" onClick={() => window.location.href = '/patient/chat'}>
              {t.startConsultation || "Commencer une consultation"}
            </button>
          </div>
        ) : (
          <div className="eso-list">
            {filteredResumes.map((item, idx) => {
              const summary    = item.esoSummary || {};
              const isExpanded = expandedId === item._id;

              return (
                <div key={item._id || idx} className="eso-card">

                  <div className="card-header">
                    <div className="card-info">
                      <div className="card-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8"  y1="2" x2="8"  y2="6"/>
                          <line x1="3"  y1="10" x2="21" y2="10"/>
                        </svg>
                        {formatDate(item.createdAt)}
                      </div>
                      <div className={`severity-badge ${getSeverityClass(summary.severity)}`}>
                        {getSeverityLabel(summary.severity)}
                      </div>
                    </div>
                    <button className="expand-btn" onClick={() => toggleExpand(item._id)}>
                      {isExpanded ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="card-preview">
                    <div className="preview-grid">
                      {summary.symptom && (
                        <div className="preview-item">
                          <span className="preview-label">{t.symptom  || "🤒 Symptôme"}</span>
                          <span className="preview-value">{summary.symptom}</span>
                        </div>
                      )}
                      {summary.bodyPart && (
                        <div className="preview-item">
                          <span className="preview-label">{t.location || "📍 Localisation"}</span>
                          <span className="preview-value">{summary.bodyPart}</span>
                        </div>
                      )}
                      {summary.duration && (
                        <div className="preview-item">
                          <span className="preview-label">{t.duration || "⏱️ Durée"}</span>
                          <span className="preview-value">{summary.duration}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="card-expanded">
                      <div className="expanded-content">
                        <div className="info-grid">
                          {summary.age && (
                            <div className="info-item">
                              <strong>{t.age || "Âge"}</strong>
                              <span>{summary.age} {t.years || "ans"}</span>
                            </div>
                          )}
                          {summary.gender && (
                            <div className="info-item">
                              <strong>{t.gender || "Sexe"}</strong>
                              <span>{summary.gender === 'homme' ? (t.male || 'Homme') : (t.female || 'Femme')}</span>
                            </div>
                          )}
                          {summary.severity && (
                            <div className="info-item">
                              <strong>{t.severity || "Gravité"}</strong>
                              <span className={getSeverityClass(summary.severity)}>
                                {getSeverityLabel(summary.severity)}
                              </span>
                            </div>
                          )}
                          {summary.temperature && (
                            <div className="info-item">
                              <strong>{t.temperature || "Température"}</strong>
                              <span>{summary.temperature}°C</span>
                            </div>
                          )}
                        </div>

                        {summary.otherSymptoms?.length > 0 && (
                          <div className="other-symptoms">
                            <strong>{t.otherSymptoms || "📝 Autres symptômes"}</strong>
                            <div className="symptoms-list">
                              {summary.otherSymptoms.map((sym, i) => (
                                <span key={i} className="symptom-tag">{sym}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {summary.recommendations && (
                          <div className="recommendations">
                            <strong>{t.recommendations || "💡 Recommandations"}</strong>
                            <p>{summary.recommendations}</p>
                          </div>
                        )}

                        <div className="json-view">
                          <strong>{t.fullDetails || "📄 Détails complets"}</strong>
                          <pre>{JSON.stringify(summary, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientESO;