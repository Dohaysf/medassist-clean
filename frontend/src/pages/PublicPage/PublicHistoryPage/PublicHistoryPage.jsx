import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicHistoryPage.css';

const PublicHistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger l'historique depuis localStorage
  useEffect(() => {
    loadHistory();
    
    // Écouter les mises à jour de l'historique
    const handleHistoryUpdate = () => loadHistory();
    window.addEventListener('historyUpdate', handleHistoryUpdate);
    
    return () => {
      window.removeEventListener('historyUpdate', handleHistoryUpdate);
    };
  }, []);

  const loadHistory = () => {
    const savedHistory = localStorage.getItem('consultationHistory');
    if (savedHistory) {
      const parsedHistory = JSON.parse(savedHistory);
      // Trier par date décroissante (plus récent en premier)
      const sortedHistory = parsedHistory.sort((a, b) => b.id - a.id);
      setHistory(sortedHistory);
    } else {
      setHistory([]);
    }
    setLoading(false);
  };

  // Supprimer un élément spécifique
  const deleteHistoryItem = (id) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('consultationHistory', JSON.stringify(updatedHistory));
    
    // Déclencher un événement pour mettre à jour le sidebar
    window.dispatchEvent(new Event('historyUpdate'));
    
    // Afficher un message temporaire
    showMessage('Consultation supprimée', 'success');
  };

  // Effacer tout l'historique
  const clearAllHistory = () => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir effacer tout votre historique ? Cette action est irréversible.')) {
      setHistory([]);
      localStorage.removeItem('consultationHistory');
      window.dispatchEvent(new Event('historyUpdate'));
      showMessage('Historique effacé', 'info');
    }
  };

  // Afficher un message temporaire
  const showMessage = (msg, type) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `toast-message ${type}`;
    messageDiv.textContent = msg;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
  };

  // Recharger la page de chat avec les symptômes
  const reloadChat = (symptoms) => {
    localStorage.setItem('prefillMessage', symptoms);
    navigate('/public/chat');
  };

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

  return (
    <PublicLayout>
      <div className="history-page">
        <div className="history-header">
          <div className="history-title">
            <h1>📋 Historique des consultations</h1>
            <p>Retrouvez vos conversations médicales précédentes</p>
          </div>
          {history.length > 0 && (
            <button className="clear-all-btn" onClick={clearAllHistory}>
              🗑️ Tout effacer
            </button>
          )}
        </div>

        <div className="history-container">
          {history.length === 0 ? (
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
                <span>📊 {history.length} consultation(s)</span>
              </div>
              <div className="history-list">
                {history.map((item) => (
                  <div key={item.id} className="history-card">
                    <div className="card-header">
                      <div className="card-info">
                        <span className="card-date">📅 {item.date}</span>
                        {item.urgency && <span className="card-urgency">🚨 Urgence</span>}
                      </div>
                      <button 
                        className="delete-btn"
                        onClick={() => deleteHistoryItem(item.id)}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="card-symptoms">
                      <span className="label">Symptômes :</span>
                      <p>{item.symptoms}</p>
                    </div>
                    
                    <div className="card-response">
                      <span className="label">Réponse :</span>
                      <p>{item.response}</p>
                    </div>
                    
                    <div className="card-footer">
                      <button 
                        className="reconsult-btn"
                        onClick={() => reloadChat(item.symptoms)}
                      >
                        🔄 Reconsulter
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