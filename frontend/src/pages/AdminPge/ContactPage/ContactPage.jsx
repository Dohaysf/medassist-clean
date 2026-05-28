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

  // Nombre de messages non lus
  const unreadCount = messages.filter(m => !m.read).length;

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

  // Sélectionner + marquer comme lu automatiquement
  const handleSelectMessage = async (msg) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      try {
        const token = localStorage.getItem('token');
        await axios.patch(
          `http://localhost:5000/api/admin/contacts/${msg._id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Mise à jour locale sans refetch
        const updated = { ...msg, read: true };
        setMessages(prev => prev.map(m => m._id === msg._id ? updated : m));
        setFilteredMessages(prev => prev.map(m => m._id === msg._id ? updated : m));
        setSelectedMessage(updated);
        // Notifie la sidebar de mettre à jour son badge
        window.dispatchEvent(new Event('contactRead'));
      } catch (err) {
        console.error('Erreur markAsRead:', err);
      }
    }
  };

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
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  if (loading) return (
    <div className="contact-loading">
      <div className="loading-spinner">⏳ Chargement des messages...</div>
    </div>
  );

  return (
    <div className="contact-page">

      {/* Topbar */}
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

      {/* Layout 2 colonnes */}
      <div className="contact-layout">

        {/* Liste */}
        <div className="messages-list">
          <div className="list-header">
            <span>📋 Messages ({filteredMessages.length})</span>
            {unreadCount > 0 && (
              <span className="unread-badge">
                {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
              </span>
            )}
          </div>

          {filteredMessages.length === 0 ? (
            <div className="no-messages">📭 Aucun message trouvé</div>
          ) : (
            filteredMessages.map(msg => (
              <div
                key={msg._id}
                className={`message-card${selectedMessage?._id === msg._id ? ' active' : ''}${!msg.read ? ' unread' : ''}`}
                onClick={() => handleSelectMessage(msg)}
              >
                <div className="message-card-header">
                  <div className="message-name">
                    <FaUser className="card-icon" />
                    {msg.name}
                    {!msg.read && <span className="unread-dot" />}
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

        {/* Détail */}
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