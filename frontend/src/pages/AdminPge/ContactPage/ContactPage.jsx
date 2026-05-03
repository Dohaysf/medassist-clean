import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaTrash, FaEnvelope, FaUser, FaCalendarAlt, FaSearch, FaReply } from 'react-icons/fa';
import './ContactPage.css';

const ContactPage = () => {
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/admin/contacts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
      setFilteredMessages(res.data);
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMessages(messages);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = messages.filter(m =>
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.message.toLowerCase().includes(term)
      );
      setFilteredMessages(filtered);
    }
  }, [searchTerm, messages]);

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMessages();
      if (selectedMessage?._id === id) setSelectedMessage(null);
    } catch (err) {
      alert('Erreur suppression');
    }
  };

  const formatDate = (date) => new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (loading) return (
    <div className="contact-loading">
      <div className="loading-spinner">⏳ Chargement des messages...</div>
    </div>
  );

  return (
    <div className="contact-page">
      {/* Topbar style chat */}
      <div className="contact-topbar">
        <span className="contact-topbar-title">📬 Messages de contact</span>
        <span className="contact-topbar-badge">Administration</span>
      </div>

      {/* Search bar */}
      <div className="contact-search-area">
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou contenu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Layout à 2 colonnes comme le chat */}
      <div className="contact-layout">
        {/* Liste des messages (comme la liste des messages dans le chat) */}
        <div className="messages-list">
          <div className="list-header">
            <span>📋 Messages ({filteredMessages.length})</span>
          </div>
          {filteredMessages.length === 0 ? (
            <div className="no-messages">📭 Aucun message trouvé</div>
          ) : (
            filteredMessages.map(msg => (
              <div
                key={msg._id}
                className={`message-card ${selectedMessage?._id === msg._id ? 'active' : ''}`}
                onClick={() => setSelectedMessage(msg)}
              >
                <div className="message-card-header">
                  <div className="message-name">
                    <FaUser className="card-icon" /> {msg.name}
                  </div>
                  <div className="message-date">
                    <FaCalendarAlt className="card-icon" /> {formatDate(msg.createdAt)}
                  </div>
                </div>
                <div className="message-email">
                  <FaEnvelope className="card-icon" /> {msg.email}
                </div>
                <div className="message-preview">
                  {msg.message.substring(0, 80)}...
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => { e.stopPropagation(); handleDelete(msg._id); }}
                >
                  <FaTrash /> Supprimer
                </button>
              </div>
            ))
          )}
        </div>

        {/* Détail du message (comme la zone de chat) */}
        <div className="message-detail">
          {selectedMessage ? (
            <>
              <div className="detail-header">
                <h2>📄 Détail du message</h2>
                <button
                  className="reply-btn"
                  onClick={() => window.location.href = `mailto:${selectedMessage.email}?subject=Réponse à votre message MedAssist`}
                >
                  <FaReply /> Répondre
                </button>
              </div>
              <div className="detail-field">
                <strong>👤 Nom :</strong>
                <span>{selectedMessage.name}</span>
              </div>
              <div className="detail-field">
                <strong>📧 Email :</strong>
                <span>{selectedMessage.email}</span>
              </div>
              <div className="detail-field">
                <strong>📅 Date :</strong>
                <span>{formatDate(selectedMessage.createdAt)}</span>
              </div>
              <div className="detail-field">
                <strong>💬 Message :</strong>
                <div className="detail-message">{selectedMessage.message}</div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <span>📌</span>
              <h3>Aucun message sélectionné</h3>
              <p>Sélectionnez un message dans la liste pour voir le détail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPage;