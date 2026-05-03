import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import './PublicChatPage.css';

// Icônes SVG
const IconMic = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconLocation = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const SUGGESTIONS = [
  "J'ai de la fièvre depuis hier",
  'Douleur thoracique légère',
  'Allergie aux arachides',
  'Blessure au genou',
];

const nowTime = () =>
  new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const PublicChatPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('publicSessionId') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const checkAuth = () => setIsAuthenticated(!!localStorage.getItem('token'));
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('publicSessionId', sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Sauvegarde locale dans l'historique
  const saveToHistory = (userMessage, botResponse, isUrgent = false) => {
    const history = localStorage.getItem('consultationHistory');
    const parsedHistory = history ? JSON.parse(history) : [];
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      symptoms: userMessage.substring(0, 200),
      response: botResponse.substring(0, 300),
      urgency: isUrgent
    };
    
    parsedHistory.unshift(newEntry);
    if (parsedHistory.length > 100) parsedHistory.pop();
    
    localStorage.setItem('consultationHistory', JSON.stringify(parsedHistory));
    window.dispatchEvent(new Event('historyUpdate'));
  };

  // Sauvegarde dans le backend (MongoDB)
  const saveConsultation = async () => {
    if (!sessionId) {
      alert("❌ Aucune session en cours");
      return;
    }
    
    if (messages.length === 0) {
      alert("❌ Aucune conversation à sauvegarder");
      return;
    }
    
    if (!isAuthenticated) {
      const confirmLogin = window.confirm(
        "💾 Pour sauvegarder cette conversation, vous devez être connecté.\n\nVoulez-vous vous connecter ou créer un compte ?"
      );
      if (confirmLogin) {
        localStorage.setItem('pendingSaveSession', sessionId);
        navigate('/login');
      }
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        'http://localhost:5000/api/chat/save-session',
        {
          sessionId: sessionId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            time: m.time,
            urgency: m.urgency || false
          }))
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        alert('✅ Consultation sauvegardée dans votre espace patient !');
        localStorage.removeItem('publicSessionId');
        localStorage.removeItem('pendingSaveSession');
        setSessionId(null);
        navigate('/patient/history');
      }
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      alert('❌ Erreur lors de la sauvegarde: ' + (err.response?.data?.error || err.message));
    }
  };

  // Vérifier sauvegarde en attente après connexion
  useEffect(() => {
    const pendingSave = localStorage.getItem('pendingSaveSession');
    if (pendingSave && isAuthenticated) {
      localStorage.removeItem('pendingSaveSession');
      setTimeout(() => saveConsultation(), 500);
    }
  }, [isAuthenticated]);

  const sendLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationMsg = `Ma position: latitude ${position.coords.latitude}, longitude ${position.coords.longitude}`;
          await sendMessage(locationMsg);
        },
        (error) => {
          console.error(error);
          alert("Impossible d'accéder à votre position");
        }
      );
    } else {
      alert("Géolocalisation non supportée");
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  };

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(currentSessionId);
    }

    const userMsg = { role: 'user', content: trimmed, time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    try {
      const res = await axios.post('http://localhost:5000/api/chat', { 
        message: trimmed,
        sessionId: currentSessionId
      });
      
      const assistantContent = res.data.reply || 'Je traite votre demande…';
      const isUrgent = res.data.urgency === true || res.data.severity === 'critique';
      
      const assistantMsg = {
        role: 'assistant',
        content: assistantContent,
        time: nowTime(),
        urgency: isUrgent
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      saveToHistory(trimmed, assistantContent, isUrgent);
      
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '❌ Une erreur est survenue. Veuillez réessayer.', time: nowTime() }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    if (messages.length > 0 && window.confirm('⚠️ Effacer cette conversation ?')) {
      setMessages([]);
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem('publicSessionId', newSessionId);
    }
  };

  return (
    <PublicLayout>
      <div className="chat-page">
        <div className="chat-topbar">
          <span className="chat-topbar-title">Consultation médicale</span>
          <span className="chat-topbar-badge">Assistant IA</span>
          <button className="new-chat-btn" onClick={resetConversation}>+ Nouveau</button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && !isTyping ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">🩺</div>
              <h2>Bonjour, comment puis-je vous aider ?</h2>
              <p>Décrivez vos symptômes et je vous fournirai des conseils adaptés à votre situation.</p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`msg-row ${msg.role}`}>
                  <div className={`msg-avatar ${msg.role}`}>
                    {msg.role === 'assistant' ? 'M' : '🙂'}
                  </div>
                  <div>
                    <div className="msg-bubble">
                      {msg.content}
                      {msg.urgency && <span className="urgency-badge">⚠️ Urgence</span>}
                    </div>
                    <div className="msg-time">{msg.time}</div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="msg-row assistant">
                  <div className="msg-avatar assistant">M</div>
                  <div className="msg-bubble" style={{ padding: 0 }}>
                    <div className="typing-indicator">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-box">
            <button className="input-tool-btn" aria-label="Caméra"><IconCamera /></button>
            <button className="input-tool-btn" aria-label="Localisation" onClick={sendLocation}>
              <IconLocation />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Décrivez vos symptômes…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button className="input-tool-btn" aria-label="Microphone"><IconMic /></button>
            <button
              className="input-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
            >
              <IconSend />
            </button>
          </div>
          <p className="chat-input-hint">MedAssist ne remplace pas un avis médical professionnel.</p>
        </div>

        {messages.length > 0 && (
          <div className="save-section">
            {!isAuthenticated ? (
              <div className="save-prompt">
                <p>💾 Sauvegardez cette conversation dans votre espace patient</p>
                <div className="save-buttons">
                  <button onClick={() => navigate('/login')}>Se connecter</button>
                  <button onClick={() => navigate('/register')}>Créer un compte</button>
                  <button className="save-btn" onClick={saveConsultation}>Sauvegarder</button>
                </div>
              </div>
            ) : (
              <button className="save-btn" onClick={saveConsultation}>
                💾 Sauvegarder cette consultation
              </button>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default PublicChatPage;