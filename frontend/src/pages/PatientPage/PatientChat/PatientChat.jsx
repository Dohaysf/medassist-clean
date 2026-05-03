import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { sendMessage as apiSendMessage } from '../../../services/api';
import useSpeechSynthesis from '../../../hooks/useSpeechSynthesis';
import useGeolocation from '../../../hooks/useGeolocation';
import './PatientChat.css';
import ReactMarkdown from 'react-markdown';

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

const SUGGESTIONS = [
  "J'ai de la fièvre depuis hier",
  'Douleur thoracique légère',
  'Allergie aux arachides',
  'Blessure au genou',
];

const nowTime = () =>
  new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Fonction pour formater le message avec badge localisation
const formatMessageWithLocation = (content) => {
  const locationMatch = content.match(/\[localisation: (.*?)\]/);
  
  if (locationMatch) {
    const location = locationMatch[1];
    const cleanMessage = content.replace(/\[localisation: .*?\]/, '').trim();
    
    return (
      <>
        <div>{cleanMessage}</div>
        <div className="message-location-badge">
          📍 {location}
        </div>
      </>
    );
  }
  
  return <div>{content}</div>;
};

const PatientChat = () => {
  const token = localStorage.getItem('token');
  const getCurrentLanguage = () => localStorage.getItem('language') || 'fr';
  const getWelcomeMessage = () => {
    const lang = getCurrentLanguage();
    return lang === 'ar'
      ? "مرحبًا، أنا المساعد الطبي. يرجى وصف حالتك."
      : "Bonjour, je suis l'assistant médical. Décrivez votre situation.";
  };

  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('currentSessionId') || null);
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [emergencyDisabled, setEmergencyDisabled] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const { speak } = useSpeechSynthesis();
  const { location, loading: locLoading, error: locError, getLocation, resetError } = useGeolocation();
  const locationSentRef = useRef(false);
  const [locationSentInThisConversation, setLocationSentInThisConversation] = useState(false);

  const saveSessionToHistory = useCallback((sid, firstMessage) => {
    try {
      const uid = localStorage.getItem('userId') || 'guest';
      const key = `chatSessions_${uid}`;
      const stored = localStorage.getItem(key);
      const sessions = stored ? JSON.parse(stored) : [];
      const existing = sessions.find(s => s.id === sid);
      if (!existing) {
        sessions.unshift({
          id: sid,
          title: firstMessage.length > 45 ? firstMessage.substring(0, 45) + '…' : firstMessage,
          updatedAt: Date.now(),
        });
        localStorage.setItem(key, JSON.stringify(sessions.slice(0, 20)));
      } else {
        existing.updatedAt = Date.now();
        localStorage.setItem(key, JSON.stringify(sessions));
      }
    } catch (e) {
      console.error('Erreur sauvegarde session:', e);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      const token = localStorage.getItem('token');
      if (!token) return;
      import('axios').then(({ default: ax }) => {
        ax.get('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          const id = res.data._id || res.data.id;
          if (id) {
            localStorage.setItem('userId', id);
            setUserId(id);
          }
        }).catch(() => {});
      });
    }
  }, [userId]);

  useEffect(() => {
    let currentSessionId = sessionId;
    if (!currentSessionId && !localStorage.getItem('currentSessionId')) {
      currentSessionId = Date.now().toString();
      setSessionId(currentSessionId);
      localStorage.setItem('currentSessionId', currentSessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ✅ PAS de stockage automatique de la localisation
  // La localisation n'est envoyée que quand l'utilisateur clique sur le bouton

  const handleSendMessage = useCallback(async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setMessages(prev => [...prev, { role: 'user', content: trimmed, time: nowTime() }]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = Date.now().toString();
      setSessionId(currentSessionId);
      localStorage.setItem('currentSessionId', currentSessionId);
    }

    try {
      // ✅ Pas de localisation automatique
      const payload = trimmed;
      
      const data = await apiSendMessage(payload, currentSessionId);
      if (data.sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('currentSessionId', data.sessionId);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, time: nowTime() }]);
      speak(data.reply);
      saveSessionToHistory(data.sessionId || currentSessionId, trimmed);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Une erreur est survenue. Veuillez réessayer.', time: nowTime() }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, sessionId, isTyping, speak, saveSessionToHistory]);

  // Envoi de la localisation SEULEMENT quand l'utilisateur clique sur le bouton
  const handleLocationClick = () => {
    resetError();
    
    if (!navigator.geolocation) {
      alert("Géolocalisation non supportée par votre navigateur");
      return;
    }
    
    // Afficher un message de chargement
    const loadingMsgId = Date.now();
    setMessages(prev => [...prev, {
      id: loadingMsgId,
      role: 'system',
      content: '⏳ Récupération de votre position...',
      time: nowTime(),
      isLocationNotification: true
    }]);
    
    getLocation(async (coords) => {
      // Supprimer le message de chargement
      setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
      
      const { latitude, longitude, address } = coords;
      const locationMsg = address 
        ? `Ma position : ${address}`
        : `Ma position : latitude ${latitude.toFixed(4)}, longitude ${longitude.toFixed(4)}`;
      
      // Envoyer la localisation comme un message (sans stockage)
      await handleSendMessage(locationMsg);
      
      locationSentRef.current = true;
      setLocationSentInThisConversation(true);
      
    }).catch((err) => {
      console.error(err);
      setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
      setMessages(prev => [...prev, {
        role: 'system',
        content: '❌ Impossible de récupérer votre position. Vérifiez vos paramètres de géolocalisation.',
        time: nowTime(),
        isLocationNotification: true
      }]);
    });
  };

  const resetConversation = useCallback(async () => {
    if (sessionId) {
      try {
        await axios.post('http://localhost:5000/api/chat/reset-session', { sessionId });
        console.log('✅ Session backend nettoyée');
      } catch (err) {
        console.error("Erreur nettoyage session:", err);
      }
    }
    const newSessionId = Date.now().toString();
    setMessages([]);
    setSessionId(newSessionId);
    localStorage.setItem('currentSessionId', newSessionId);
    setInput('');
    window.speechSynthesis?.cancel();
    locationSentRef.current = false;
    setLocationSentInThisConversation(false);
    resetError();
    setEmergencyDisabled(false);
    console.log('🔄 Nouvelle conversation créée, ID:', newSessionId);
  }, [sessionId, resetError]);

  const handleEmergency = useCallback(async () => {
    if (!sessionId) {
      alert("Veuillez d'abord envoyer un message pour démarrer une session.");
      return;
    }
    const confirmSend = window.confirm("⚠️ Confirmez-vous l'envoi d'une alerte d'urgence ? Un SMS sera envoyé à l'équipe médicale.");
    if (!confirmSend) return;

    setEmergencyDisabled(true);
    try {
      const response = await axios.post('http://localhost:5000/api/chat/emergency-manual', {
        sessionId,
        summary: {}
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Alerte envoyée. Un agent va vous contacter rapidement.");
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply, time: nowTime() }]);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de l'alerte.");
    } finally {
      setTimeout(() => setEmergencyDisabled(false), 5000);
    }
  }, [sessionId, token]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-topbar">
        <span className="chat-topbar-title">Consultation médicale</span>
        <span className="chat-topbar-badge">Assistant IA</span>
        <button className="new-chat-btn" onClick={resetConversation} title="Nouvelle conversation">
          + Nouveau
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !isTyping ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">🩺</div>
            <h2>{getWelcomeMessage()}</h2>
            <p>Décrivez vos symptômes et je vous fournirai des conseils adaptés à votre situation.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => handleSendMessage(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              if (msg.isLocationNotification) {
                return (
                  <div key={i} className="system-message">
                    <div className="system-message-content">{msg.content}</div>
                  </div>
                );
              }
              
              return (
                <div key={i} className={`msg-row ${msg.role}`}>
                  <div className={`msg-avatar ${msg.role}`}>
                    {msg.role === 'assistant' ? 'M' : '🙂'}
                  </div>
                  <div>
                    <div className="msg-bubble">
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        formatMessageWithLocation(msg.content)
                      )}
                    </div>
                    <div className="msg-time">{msg.time}</div>
                  </div>
                </div>
              );
            })}
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
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Décrivez vos symptômes…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <button className="input-tool-btn" aria-label="Microphone"><IconMic /></button>
          <button
            className="input-tool-btn location-btn"
            onClick={handleLocationClick}
            disabled={locLoading}
            title="Me localiser"
          >
            {locLoading ? '⏳' : '📍'}
          </button>
          <button
            className="input-tool-btn emergency-btn"
            onClick={handleEmergency}
            disabled={emergencyDisabled}
            title="Alerte d'urgence immédiate"
          >
            🚨
          </button>
          <button
            className="input-send-btn"
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isTyping}
          >
            <IconSend />
          </button>
        </div>

        {!locationSentInThisConversation && !locLoading && !locationSentRef.current && (
          <div className="location-prompt">
            📍 Partagez votre position pour une intervention plus rapide (optionnel)
          </div>
        )}
        {locError && (
          <div className="location-error">
            {locError} <button onClick={() => window.location.reload()}>Recharger</button>
          </div>
        )}

        <p className="chat-input-hint">MedAssist ne remplace pas un avis médical professionnel.</p>
      </div>
    </div>
  );
};

export default PatientChat;