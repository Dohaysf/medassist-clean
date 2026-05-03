import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './PatientHistory.css';

const PatientHistory = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError('Erreur lors du chargement de l\'historique');
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="patient-history">
        <div className="loading-spinner">⏳ Chargement de votre historique...</div>
      </div>
    );
  }

  return (
    <div className="patient-history">
      <div className="history-header">
        <h1>📋 Mon historique médical</h1>
        <button className="refresh-btn" onClick={fetchHistory}>🔄 Actualiser</button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {conversations.length === 0 ? (
        <div className="empty-history">
          <span>📭</span>
          <h3>Aucune consultation</h3>
          <p>Vos consultations sauvegardées apparaîtront ici.</p>
          <button className="start-chat-btn" onClick={() => navigate('/patient/chat')}>
            Commencer une consultation
          </button>
        </div>
      ) : (
        <div className="history-list">
          {conversations.map(conv => (
            <div key={conv.id} className="history-card">
              <div className="history-date">{conv.date}</div>
              <div className="history-title">{conv.title}</div>
              <div className="history-preview">{conv.preview}</div>
              <div className="history-footer">
                <span className="message-count">📨 {conv.messageCount} messages</span>
                <button 
                  className="view-btn"
                  onClick={() => navigate(`/patient/chat?session=${conv.sessionId}`)}
                >
                  Voir la consultation
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientHistory;