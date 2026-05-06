import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicHistoryPage.css';

const PublicHistoryPage = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCurrentSession = async () => {
    setLoading(true);
    
    try {
      // Récupérer l'ID de session depuis localStorage
      let sessionId = localStorage.getItem('currentSessionId');
      
      console.log('🔑 Session ID:', sessionId);
      
      // Si pas de session, en créer une
      if (!sessionId) {
        sessionId = Date.now().toString();
        localStorage.setItem('currentSessionId', sessionId);
      }
      
      // Appeler l'API
      const response = await axios.get('http://localhost:5000/api/public/history', {
        headers: { 'X-Session-Id': sessionId }
      });
      
      console.log('📊 Réponse:', response.data);
      
      if (response.data && response.data.length > 0) {
        setConversations(response.data);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('❌ Erreur:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentSession();
  }, []);

  const continueChat = () => {
    navigate('/public/chat');
  };

  const startNewChat = async () => {
    // Créer une nouvelle session
    const newSessionId = Date.now().toString();
    localStorage.setItem('currentSessionId', newSessionId);
    
    // Option: appeler une API pour reset la session
    try {
      await axios.post('http://localhost:5000/api/chat/reset-session', { 
        sessionId: newSessionId 
      });
    } catch (err) {
      console.log('Reset non nécessaire');
    }
    
    setConversations([]);
    navigate('/public/chat');
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 1) return "À l'instant";
      if (minutes < 60) return `Il y a ${minutes} min`;
      if (hours < 24) return `Il y a ${hours} h`;
      if (days < 7) return `Il y a ${days} j`;
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
            <div className="loading-dots">
              <span></span><span></span><span></span>
            </div>
            <p>Chargement...</p>
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
            <h1>Ma consultation en cours</h1>
          </div>
          <button className="new-chat-btn" onClick={startNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouvelle consultation
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="history-empty">
            <div className="empty-icon">💬</div>
            <h3>Aucune consultation en cours</h3>
            <p>Commencez une consultation médicale pour voir votre conversation apparaître ici.</p>
            <button className="empty-start-btn" onClick={startNewChat}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Commencer une consultation
            </button>
          </div>
        ) : (
          <div className="history-container">
            <div className="session-info">
              <div className="info-badge">
                <span className="badge-icon">🟢</span>
                Session active
              </div>
              <button className="refresh-btn" onClick={loadCurrentSession}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Actualiser
              </button>
            </div>

            <div className="history-list">
              {conversations.map((item) => (
                <div key={item.id} className="history-card">
                  <div className="card-header">
                    <div className="card-date">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {formatDate(item.date)}
                    </div>
                    <div className="message-count">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {item.messageCount} messages
                    </div>
                  </div>
                  
                  <div className="card-title">
                    {item.title}
                  </div>
                  
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
                      Continuer la consultation
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="info-message">
                <span>💡</span>
                <p>
                  Les consultations non connectées sont conservées temporairement. 
                  <button className="link-btn" onClick={() => navigate('/login')}> Connectez-vous</button> 
                  pour sauvegarder votre historique.
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