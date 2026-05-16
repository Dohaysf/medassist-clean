// frontend/src/pages/HistoryPage/HistoryPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaSearch, FaCalendarAlt, FaUser, FaMapMarkerAlt, FaHeartbeat, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './HistoryPage.css';

const HistoryPage = () => {
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/eso/sessions')
      .then(res => {
        setSessions(res.data);
        setFilteredSessions(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSessions(sessions);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = sessions.filter(s => {
        const eso = s.esoSummary || {};
        return (eso.symptom?.toLowerCase().includes(term) ||
                eso.bodyPart?.toLowerCase().includes(term) ||
                eso.severity?.toLowerCase().includes(term) ||
                eso.patientLocation?.toLowerCase().includes(term));
      });
      setFilteredSessions(filtered);
    }
  }, [searchTerm, sessions]);

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getSeverityClass = (severity) => {
    switch(severity) {
      case 'critique': return 'severity-critical';
      case 'urgent': return 'severity-urgent';
      case 'moyenne': return 'severity-moderate';
      case 'faible': return 'severity-normal';
      default: return 'severity-normal';
    }
  };

  const getSeverityLabel = (severity) => {
    if (!severity) return 'Normal';
    const labels = {
      'critique': '⚠️ Critique',
      'urgent': '🔴 Urgent',
      'moyenne': '🟡 Modéré',
      'faible': '🟢 Léger'
    };
    return labels[severity.toLowerCase()] || severity;
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return "Aujourd'hui";
      if (days === 1) return "Hier";
      if (days < 7) return `Il y a ${days} jours`;
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="history-page">
        <div className="history-loading">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Chargement de l'historique...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>📜 Historique des consultations</h1>
        <p>Retrouvez toutes les conversations passées et leurs résumés médicaux</p>
      </div>

      <div className="history-controls">
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par symptôme, zone, gravité..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sort-control">
          <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
            <FaCalendarAlt /> {sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}
            {sortOrder === 'desc' ? <FaChevronDown /> : <FaChevronUp />}
          </button>
        </div>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="no-results">
          <div className="empty-icon">📭</div>
          <p>Aucune consultation trouvée</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sortedSessions.map(session => {
            const eso = session.esoSummary || {};
            const severityClass = getSeverityClass(eso.severity);
            const isExpanded = expandedId === session.sessionId;
            return (
              <div key={session.sessionId} className="session-card">
                <div className="session-card-header" onClick={() => toggleExpand(session.sessionId)}>
                  <div className="session-date">
                    <FaCalendarAlt /> {formatDate(session.createdAt)}
                  </div>
                  <div className={`severity-badge ${severityClass}`}>
                    {getSeverityLabel(eso.severity)}
                  </div>
                </div>
                
                <div className="session-card-preview" onClick={() => toggleExpand(session.sessionId)}>
                  <div className="preview-item">
                    <span className="preview-label">🤒 Symptôme</span>
                    <span className="preview-value">{eso.symptom || 'Non spécifié'}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">📍 Zone</span>
                    <span className="preview-value">{eso.bodyPart || 'Non spécifiée'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="session-card-details">
                    <div className="details-grid">
                      {eso.duration && (
                        <div className="detail-item">
                          <strong>⏱️ Durée</strong>
                          <span>{eso.duration}</span>
                        </div>
                      )}
                      {eso.intensity && (
                        <div className="detail-item">
                          <strong>📊 Intensité</strong>
                          <span>{eso.intensity}/10</span>
                        </div>
                      )}
                      {eso.age && (
                        <div className="detail-item">
                          <strong>👤 Âge</strong>
                          <span>{eso.age} ans</span>
                        </div>
                      )}
                      {eso.patientLocation && (
                        <div className="detail-item">
                          <strong>📍 Lieu</strong>
                          <span>{eso.patientLocation}</span>
                        </div>
                      )}
                    </div>
                    
                    {session.messages && session.messages.length > 0 && (
                      <div className="details-messages">
                        <strong>💬 Messages récents</strong>
                        <div className="messages-preview">
                          {session.messages.slice(-4).map((msg, idx) => (
                            <div key={idx} className={`message-preview ${msg.sender}`}>
                              <span className="sender">{msg.sender === 'user' ? '👤 Vous' : '🤖 Assistant'}</span>
                              <span className="text">{msg.text.length > 100 ? msg.text.substring(0, 100) + '…' : msg.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="expand-indicator" onClick={() => toggleExpand(session.sessionId)}>
                  {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;