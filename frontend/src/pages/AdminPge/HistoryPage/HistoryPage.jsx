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
      case 'critique': return 'severity-high';
      case 'moyenne': return 'severity-medium';
      case 'faible': return 'severity-low';
      default: return '';
    }
  };

  const formatSeverity = (severity) => {
    if (!severity) return 'Non évalué';
    switch(severity) {
      case 'critique': return 'Critique';
      case 'moyenne': return 'Moyenne';
      case 'faible': return 'Faible';
      default: return severity;
    }
  };

  const formatBodyPart = (part) => {
    if (!part) return 'Non spécifiée';
    const map = {
      tete: 'tête',
      poitrine: 'poitrine',
      ventre: 'ventre',
      dos: 'dos',
      jambe: 'jambe',
      bras: 'bras',
      cou: 'cou',
      pied: 'pied',
      main: 'main'
    };
    return map[part] || part;
  };

  if (loading) return <div className="history-loading">Chargement de l'historique...</div>;

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
            placeholder="Rechercher par symptôme, zone anatomique, gravité..."
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
          <p>Aucune conversation trouvée</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sortedSessions.map(session => {
            const eso = session.esoSummary || {};
            const severityClass = getSeverityClass(eso.severity);
            const isExpanded = expandedId === session.sessionId;
            return (
              <div key={session.sessionId} className="session-card" onClick={() => toggleExpand(session.sessionId)}>
                <div className="session-card-header">
                  <div className="session-date">
                    <FaCalendarAlt /> {new Date(session.createdAt).toLocaleString()}
                  </div>
                  <div className={`severity-badge ${severityClass}`}>
                    <FaHeartbeat /> {formatSeverity(eso.severity)}
                  </div>
                </div>
                <div className="session-card-preview">
                  <div className="preview-item">
                    <FaUser /> <strong>Symptôme :</strong> {eso.symptom || 'Non spécifié'}
                  </div>
                  <div className="preview-item">
                    <FaMapMarkerAlt /> <strong>Zone anatomique :</strong> {formatBodyPart(eso.bodyPart)}
                  </div>
                </div>
                {isExpanded && (
                  <div className="session-card-details">
                    <div className="details-grid">
                      <div><strong>Durée :</strong> {eso.duration || '—'}</div>
                      <div><strong>Intensité :</strong> {eso.intensity ? `${eso.intensity}/10` : '—'}</div>
                      <div><strong>Âge :</strong> {eso.age || '—'}</div>
                      <div><strong>Adresse :</strong> {eso.patientLocation || '—'}</div>
                    </div>
                    <div className="details-messages">
                      <strong>Messages récents :</strong>
                      <div className="messages-preview">
                        {session.messages?.slice(-4).map((msg, idx) => (
                          <div key={idx} className={`message-preview ${msg.sender}`}>
                            <span className="sender">{msg.sender === 'user' ? '👤 Vous' : '🤖 Assistant'}</span>
                            <span className="text">{msg.text.length > 80 ? msg.text.substring(0,80)+'...' : msg.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="expand-indicator">
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