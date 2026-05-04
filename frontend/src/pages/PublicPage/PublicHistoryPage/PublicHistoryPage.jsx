import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicHistoryPage.css';

const PublicHistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get('http://localhost:5000/api/chat/history', { headers });
      
      if (response.data && response.data.length > 0) {
        setHistory(response.data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error('Erreur chargement historique:', err);
      setError('Impossible de charger l\'historique');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une consultation spécifique
  const deleteHistoryItem = async (id) => {
    if (!window.confirm('Supprimer cette consultation ?')) return;
    
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.delete(`http://localhost:5000/api/chat/history/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      // Mettre à jour l'affichage local
      setHistory(prev => prev.filter(item => item.id !== id && item._id !== id));
      showMessage('Consultation supprimée', 'success');
      
    } catch (err) {
      console.error('Erreur suppression:', err);
      showMessage('Erreur lors de la suppression', 'error');
    }
  };

  // Effacer tout l'historique
  const clearAllHistory = async () => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir effacer tout votre historique ? Cette action est irréversible.')) return;
    
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.delete('http://localhost:5000/api/chat/history/all', {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setHistory([]);
      showMessage('Historique effacé', 'success');
      
    } catch (err) {
      console.error('Erreur suppression totale:', err);
      showMessage('Erreur lors de la suppression', 'error');
    }
  };

  const showMessage = (msg, type) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `toast-message ${type === 'error' ? 'error' : 'success'}`;
    messageDiv.textContent = msg;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
  };

  const reloadChat = (sessionId, title) => {
    localStorage.setItem('currentSessionId', sessionId);
    localStorage.setItem('prefillMessage', title || '');
    navigate('/public/chat');
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getFilteredHistory = () => {
    if (filter === 'urgent') {
      return history.filter(item => item.urgency === true);
    }
    return history;
  };

  const filteredHistory = getFilteredHistory();

  if (loading) {
    return (
      <PublicLayout>
        <div className="history-loading">
          <div className="spinner"></div>
          <p>Chargement de votre historique...</p>
        </div>
      </PublicLayout>
    );
  }

  if (error) {
    return (
      <PublicLayout>
        <div className="history-error">
          <div className="error-icon">⚠️</div>
          <h3>Erreur de chargement</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={loadHistory}>Réessayer</button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="history-page">
        <div className="history-header">
          <div className="history-title">
            <h1>📋 Historique des consultations</h1>
            <p>Retrouvez l'ensemble de vos conversations médicales</p>
          </div>
          {history.length > 0 && (
            <button className="clear-all-btn" onClick={clearAllHistory}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Tout effacer
            </button>
          )}
        </div>

        {history.length > 0 && (
          <div className="history-filters">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Toutes
            </button>
            <button 
              className={`filter-btn ${filter === 'urgent' ? 'active' : ''}`}
              onClick={() => setFilter('urgent')}
            >
              🚨 Urgences
            </button>
          </div>
        )}

        <div className="history-container">
          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>Aucune consultation</h3>
              <p>Vos conversations apparaîtront ici après avoir consulté MedAssist.</p>
              <button className="start-btn" onClick={() => navigate('/public/chat')}>
                ✨ Commencer une consultation
              </button>
            </div>
          ) : (
            <>
              <div className="history-stats">
                <div className="stats-left">
                  <span className="stats-count">📊 {filteredHistory.length} consultation(s)</span>
                  {filter === 'urgent' && <span className="stats-badge">⚠️ Urgences uniquement</span>}
                </div>
                <button className="refresh-btn" onClick={loadHistory}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Actualiser
                </button>
              </div>
              <div className="history-list">
                {filteredHistory.map((item) => (
                  <div key={item.id || item._id} className="history-card">
                    <div className="card-header">
                      <div className="card-info">
                        <span className="card-date">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                          {formatDate(item.date || item.createdAt)}
                        </span>
                        {item.urgency && (
                          <span className="card-urgency">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            Urgence
                          </span>
                        )}
                        <span className="card-messages">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                          {item.messageCount || 0} messages
                        </span>
                      </div>
                      <button 
                        className="delete-btn"
                        onClick={() => deleteHistoryItem(item.id || item._id)}
                        title="Supprimer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    
                    <div className="card-symptoms">
                      <span className="label">📝 Consultation</span>
                      <p>{item.title || item.symptoms || 'Consultation médicale'}</p>
                    </div>
                    
                    <div className="card-preview">
                      <span className="label">💬 Aperçu</span>
                      <p>{item.preview || (item.response && item.response.substring(0, 120)) || 'Aucun détail'}</p>
                    </div>
                    
                    <div className="card-footer">
                      <button 
                        className="reconsult-btn"
                        onClick={() => reloadChat(item.sessionId, item.symptoms || item.title)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0z"></path>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Reconsulter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default PublicHistoryPage;