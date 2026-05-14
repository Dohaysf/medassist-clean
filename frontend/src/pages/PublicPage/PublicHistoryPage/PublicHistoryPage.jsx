import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import useTranslation from '../../../hooks/useTranslation';
import './PublicHistoryPage.css';

const PublicHistoryPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const T = t('history');

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCurrentSession = async () => {
    setLoading(true);
    try {
      let sessionId = localStorage.getItem('currentSessionId');
      if (!sessionId) {
        sessionId = Date.now().toString();
        localStorage.setItem('currentSessionId', sessionId);
      }
      const response = await axios.get('http://localhost:5000/api/public/history', {
        headers: { 'X-Session-Id': sessionId }
      });
      setConversations(response.data?.length > 0 ? response.data : []);
    } catch (err) {
      console.error('❌ Erreur:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCurrentSession(); }, []);

  const continueChat = () => navigate('/public/chat');

  const startNewChat = async () => {
    const newSessionId = Date.now().toString();
    localStorage.setItem('currentSessionId', newSessionId);
    try {
      await axios.post('http://localhost:5000/api/chat/reset-session', { sessionId: newSessionId });
    } catch { /* not required */ }
    setConversations([]);
    navigate('/public/chat');
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const diff = Date.now() - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (minutes < 1) return T.justNow;
      if (minutes < 60) return `${T.minutesAgo} ${minutes} ${T.min}`;
      if (hours < 24) return `${T.hoursAgo} ${hours} ${T.h}`;
      if (days < 7) return `${T.daysAgo} ${days} ${T.d}`;
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="public-history-page">
          <div className="history-loading">
            <div className="loading-dots"><span></span><span></span><span></span></div>
            <p>{T.loading}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="public-history-page">
        <div className="history-topbar">
          <div className="topbar-left">
            <span className="topbar-icon">🌐</span>
            <h1>{T.title}</h1>
          </div>
          <button className="new-chat-btn" onClick={startNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {T.newConsultation}
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="history-empty">
            <div className="empty-icon">💬</div>
            <h3>{T.noConsultation}</h3>
            <p>{T.noConsultationDesc}</p>
            <button className="empty-start-btn" onClick={startNewChat}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {T.startConsultation}
            </button>
          </div>
        ) : (
          <div className="history-container">
            <div className="session-info">
              <div className="info-badge">
                <span className="badge-icon">🟢</span>
                {T.activeSession}
              </div>
              <button className="refresh-btn" onClick={loadCurrentSession}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {T.refresh}
              </button>
            </div>

            <div className="history-list">
              {conversations.map((item) => (
                <div key={item.id} className="history-card">
                  <div className="card-header">
                    <div className="card-date">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {formatDate(item.date)}
                    </div>
                    <div className="message-count">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {item.messageCount} {T.messages}
                    </div>
                  </div>
                  <div className="card-title">{item.title}</div>
                  {item.preview && (
                    <div className="card-preview">
                      {item.preview.length > 150 ? item.preview.substring(0, 150) + '…' : item.preview}
                    </div>
                  )}
                  <div className="card-footer">
                    <button className="continue-btn" onClick={continueChat}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      {T.continue}
                    </button>
                  </div>
                </div>
              ))}

              <div className="info-message">
                <span>💡</span>
                <p>
                  {T.tip}
                  <button className="link-btn" onClick={() => navigate('/login')}>{T.login}</button>
                  {T.tipSuffix}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default PublicHistoryPage;