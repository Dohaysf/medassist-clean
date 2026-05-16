import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import translations from '../../../translation'; // Ajuste le chemin si nécessaire
import './PatientHistory.css';

const PatientHistory = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Gestion de la langue
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  const t = (translations[lang] || translations.fr).patientHistory;
  const isRTL = lang === 'ar';

  // Écoute les changements de langue
  useEffect(() => {
    const handleLangChange = (e) => {
      const newLang = e.detail?.language || localStorage.getItem('language') || 'fr';
      setLang(newLang);
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const res = await axios.get('http://localhost:5000/api/chat/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConversations(res.data);
    } catch (err) {
      console.error('Erreur:', err);
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(t.errorLoading || 'Erreur lors du chargement de votre historique');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return t.today || "Aujourd'hui";
      if (days === 1) return t.yesterday || "Hier";
      if (days < 7) return `${t.daysAgo || "Il y a"} ${days} ${t.days || "jours"}`;
      return date.toLocaleDateString(lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="patient-history-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="history-loading">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>{t.loading || "Chargement de votre historique..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-history-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="history-topbar">
        <div className="topbar-left">
          <span className="topbar-icon">👤</span>
          <h1>{t.title || "Mes consultations"}</h1>
        </div>
        <button className="refresh-btn" onClick={fetchHistory}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {t.refresh || "Actualiser"}
        </button>
      </div>

      {error && (
        <div className="history-error">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={fetchHistory}>{t.retry || "Réessayer"}</button>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="history-empty">
          <div className="empty-icon">📭</div>
          <h3>{t.noConsultation || "Aucune consultation"}</h3>
          <p>{t.noConsultationDesc || "Vos consultations personnelles apparaîtront ici."}</p>
          <button className="empty-start-btn" onClick={() => navigate('/patient/chat')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {t.startConsultation || "Commencer une consultation"}
          </button>
        </div>
      ) : (
        <>
          <div className="history-stats">
            <div className="stat-card">
              <span className="stat-number">{conversations.length}</span>
              <span className="stat-label">{t.consultations || "Consultations"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">
                {conversations.reduce((sum, c) => sum + (c.messageCount || 0), 0)}
              </span>
              <span className="stat-label">{t.messagesExchanged || "Messages échangés"}</span>
            </div>
          </div>

          <div className="history-list">
            {conversations.map((conv, index) => (
              <div key={conv.id || conv._id} className="history-card" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="card-header">
                  <div className="card-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {formatDate(conv.date || conv.updatedAt)}
                  </div>
                  {conv.urgency && (
                    <div className="urgency-badge">{t.urgent || "⚠️ Urgent"}</div>
                  )}
                  <div className="message-count">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {conv.messageCount || 0}
                  </div>
                </div>
                
                <div className="card-title">
                  {conv.title || (t.medicalConsultation || "Consultation médicale")}
                </div>
                
                {conv.preview && (
                  <div className="card-preview">
                    {conv.preview.length > 100 ? conv.preview.substring(0, 100) + '…' : conv.preview}
                  </div>
                )}
                
                <div className="card-footer">
                  <button 
                    className="view-btn"
                    onClick={() => navigate(`/patient/chat?session=${conv.sessionId}`)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    {t.viewConsultation || "Voir la consultation"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PatientHistory;