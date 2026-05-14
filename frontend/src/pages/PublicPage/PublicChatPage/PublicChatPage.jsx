// frontend/src/pages/PublicChatPage/PublicChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import useSpeechSynthesis from '../../../hooks/useSpeechSynthesis';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import useGeolocation from '../../../hooks/useGeolocation';
import ReactMarkdown from 'react-markdown';
import './PublicChatPage.css';

// Icônes
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

// Contenu multilingue
const I18N = {
  fr: {
    title: 'Consultation médicale',
    badge: 'Assistant IA',
    newBtn: '+ Nouveau',
    welcome: "Bonjour, je suis l'assistant médical. Décrivez votre situation.",
    welcomeSub: 'Décrivez vos symptômes et je vous fournirai des conseils adaptés.',
    placeholder: 'Décrivez vos symptômes…',
    recording: 'Enregistrement… Parlez maintenant',
    transcribing: 'Transcription en cours…',
    hint: 'MedAssist ne remplace pas un avis médical professionnel.',
    locationPrompt: 'Partagez votre position pour une intervention plus rapide (optionnel)',
    suggestions: [
      "J'ai de la fièvre depuis hier",
      'Douleur thoracique légère',
      'Allergie aux arachides',
      'Blessure au genou',
    ],
  },
  ar: {
    title: 'الاستشارة الطبية',
    badge: 'مساعد ذكاء اصطناعي',
    newBtn: '+ جديد',
    welcome: 'مرحبًا، أنا المساعد الطبي. يرجى وصف حالتك.',
    welcomeSub: 'صف أعراضك وسأقدم لك النصائح المناسبة.',
    placeholder: 'صف أعراضك…',
    recording: 'جارٍ التسجيل… تحدث الآن',
    transcribing: 'جارٍ التحويل…',
    hint: 'لا يُغني MedAssist عن الاستشارة الطبية المتخصصة.',
    locationPrompt: 'شارك موقعك لتدخل أسرع (اختياري)',
    suggestions: [
      'عندي حمى من أمس',
      'ألم خفيف في الصدر',
      'حساسية من الفول السوداني',
      'إصابة في الركبة',
    ],
  },
};

const nowTime = () =>
  new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const formatMessageWithLocation = (content) => {
  const locationMatch = content.match(/\[localisation: (.*?)\]/);
  if (locationMatch) {
    const location = locationMatch[1];
    const cleanMessage = content.replace(/\[localisation: .*?\]/, '').trim();
    return (
      <>
        <div>{cleanMessage}</div>
        <div className="message-location-badge">📍 {location}</div>
      </>
    );
  }
  return <div>{content}</div>;
};

const PublicChatPage = () => {
  const navigate = useNavigate();

  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  const t = I18N[lang] || I18N.fr;
  const isRTL = lang === 'ar';

  const toggleLang = () => {
    const next = lang === 'fr' ? 'ar' : 'fr';
    setLang(next);
    localStorage.setItem('language', next);
  };

  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('publicSessionId') || null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [emergencyDisabled, setEmergencyDisabled] = useState(false);
  const [playingMsgIdx, setPlayingMsgIdx] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const isTypingRef = useRef(false);

  const { speak, cancel } = useSpeechSynthesis();
  const { transcript, transcriptTs, listening, isLoading: micLoading, toggleListening } = useSpeechRecognition();
  const { loading: locLoading, error: locError, getLocation, resetError } = useGeolocation();

  const locationSentRef = useRef(false);
  const [locationSentInThisConversation, setLocationSentInThisConversation] = useState(false);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  useEffect(() => {
    const check = () => setIsAuthenticated(!!localStorage.getItem('token'));
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  useEffect(() => {
    if (sessionId) localStorage.setItem('publicSessionId', sessionId);
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current && messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Sauvegarde par SESSION (une conversation = un élément)
  const saveConversationToHistory = (userMessage, botResponse, sid, isUrgent = false) => {
    const stored = localStorage.getItem('publicConversations');
    let conversations = stored ? JSON.parse(stored) : [];
    
    let existingConversation = conversations.find(c => c.sessionId === sid);
    
    if (existingConversation) {
      existingConversation.messages.push({
        user: userMessage,
        assistant: botResponse,
        time: nowTime(),
        isUrgent
      });
      existingConversation.updatedAt = new Date().toISOString();
      existingConversation.messageCount = existingConversation.messages.length;
    } else {
      conversations.unshift({
        sessionId: sid,
        title: userMessage.substring(0, 50),
        messages: [{
          user: userMessage,
          assistant: botResponse,
          time: nowTime(),
          isUrgent
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 1
      });
    }
    
    if (conversations.length > 30) conversations.pop();
    
    localStorage.setItem('publicConversations', JSON.stringify(conversations));
    window.dispatchEvent(new Event('conversationsUpdate'));
  };

  // Migration ancien format
  useEffect(() => {
    const oldHistory = localStorage.getItem('consultationHistory');
    const newConversations = localStorage.getItem('publicConversations');
    
    if (oldHistory && !newConversations) {
      const oldItems = JSON.parse(oldHistory);
      const converted = [];
      
      oldItems.forEach(item => {
        converted.push({
          sessionId: `session_${item.id}`,
          title: item.symptoms?.substring(0, 50) || 'Consultation',
          messages: [{
            user: item.symptoms,
            assistant: item.response,
            time: '--:--',
            isUrgent: item.urgency || false
          }],
          createdAt: item.date,
          updatedAt: item.date,
          messageCount: 1
        });
      });
      
      localStorage.setItem('publicConversations', JSON.stringify(converted));
      console.log('✅ Ancien format converti');
    }
  }, []);

  // Sauvegarde MongoDB
  const saveConsultation = useCallback(async () => {
    if (!sessionId) { alert('❌ Aucune session en cours'); return; }
    if (!messages.length) { alert('❌ Aucune conversation à sauvegarder'); return; }
    if (!isAuthenticated) {
      const ok = window.confirm(
        lang === 'ar'
          ? 'يجب تسجيل الدخول للحفظ. هل تريد تسجيل الدخول؟'
          : 'Pour sauvegarder, vous devez être connecté. Voulez-vous vous connecter ?'
      );
      if (ok) { localStorage.setItem('pendingSaveSession', sessionId); navigate('/login'); }
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/chat/save-session',
        { sessionId, messages: messages.map(m => ({ role: m.role, content: m.content, time: m.time })) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(lang === 'ar' ? '✅ تم حفظ الاستشارة!' : '✅ Consultation sauvegardée !');
      localStorage.removeItem('publicSessionId');
      localStorage.removeItem('pendingSaveSession');
      setSessionId(null);
      navigate('/patient/history');
    } catch (err) {
      console.error(err);
      alert('❌ ' + (err.response?.data?.error || err.message));
    }
  }, [sessionId, messages, isAuthenticated, lang, navigate]);

  useEffect(() => {
    const pending = localStorage.getItem('pendingSaveSession');
    if (pending && isAuthenticated) {
      localStorage.removeItem('pendingSaveSession');
      setTimeout(() => saveConsultation(), 500);
    }
  }, [isAuthenticated, saveConsultation]);

  // Envoi message
  const sendText = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || isTypingRef.current) return;

    setMessages(prev => [...prev, { role: 'user', content: trimmed, time: nowTime() }]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    let sid = sessionIdRef.current;
    if (!sid) {
      sid = Date.now().toString();
      setSessionId(sid);
      sessionIdRef.current = sid;
      localStorage.setItem('publicSessionId', sid);
    }

    try {
      const res = await axios.post('http://localhost:5000/api/chat', { message: trimmed, sessionId: sid });
      const reply = res.data.reply || (lang === 'ar' ? 'جارٍ المعالجة…' : 'Je traite votre demande…');
      const isUrgent = res.data.severity === 'critique';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, time: nowTime(), urgency: isUrgent }]);
      saveConversationToHistory(trimmed, reply, sid, isUrgent);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: lang === 'ar' ? 'حدث خطأ. يرجى المحاولة مرة أخرى.' : 'Une erreur est survenue. Veuillez réessayer.',
        time: nowTime()
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [lang]);

  useEffect(() => {
    if (transcript && transcript.trim() && transcriptTs > 0) {
      sendText(transcript);
    }
  }, [transcriptTs, sendText]);

  const handleSendMessage = useCallback(async (text = input) => {
    await sendText(text);
  }, [input, sendText]);

  // Géolocalisation
  const handleLocationClick = () => {
    resetError();
    if (!navigator.geolocation) { alert('Géolocalisation non supportée'); return; }
    
    const loadingMsgId = Date.now();
    setMessages(prev => [...prev, {
      id: loadingMsgId, role: 'system',
      content: lang === 'ar' ? 'جارٍ تحديد موقعك...' : 'Récupération de votre position...',
      time: nowTime(), isLocationNotification: true
    }]);
    
    getLocation(async (coords) => {
      setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
      const { latitude, longitude, address } = coords;
      const locationMsg = address 
        ? `Ma position : ${address}`
        : `Ma position : latitude ${latitude.toFixed(4)}, longitude ${longitude.toFixed(4)}`;
      await handleSendMessage(locationMsg);
      locationSentRef.current = true;
      setLocationSentInThisConversation(true);
    }).catch(() => {
      setMessages(prev => prev.filter(msg => msg.id !== loadingMsgId));
      setMessages(prev => [...prev, {
        role: 'system',
        content: lang === 'ar' ? 'تعذر تحديد الموقع.' : 'Impossible de récupérer votre position.',
        time: nowTime(), isLocationNotification: true
      }]);
    });
  };

  // Reset conversation
  const resetConversation = useCallback(async () => {
    if (sessionId) {
      try {
        await axios.post('http://localhost:5000/api/chat/reset-session', { sessionId });
        console.log('✅ Session backend réinitialisée');
      } catch (err) {
        console.error("Erreur nettoyage session:", err);
      }
    }
    const newId = Date.now().toString();
    setMessages([]);
    setSessionId(newId);
    localStorage.setItem('publicSessionId', newId);
    setInput('');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    cancel();
    locationSentRef.current = false;
    setLocationSentInThisConversation(false);
    resetError();
    setEmergencyDisabled(false);
    setPlayingMsgIdx(null);
    console.log('🔄 Nouvelle conversation publique créée, ID:', newId);
  }, [sessionId, resetError, cancel]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  // Bouton urgence
  const handleEmergency = useCallback(async () => {
    if (!sessionId) { alert(lang === 'ar' ? 'أرسل رسالة أولاً.' : "Envoyez d'abord un message."); return; }
    const msg = lang === 'ar'
      ? 'هل تؤكد إرسال تنبيه طارئ؟'
      : "Confirmez-vous l'envoi d'une alerte d'urgence ?";
    if (!window.confirm(msg)) return;
    setEmergencyDisabled(true);
    try {
      const response = await axios.post('http://localhost:5000/api/chat/emergency-manual', {
        sessionId, summary: {}
      });
      alert(lang === 'ar' ? 'تم إرسال التنبيه.' : 'Alerte envoyée.');
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply, time: nowTime() }]);
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'خطأ في إرسال التنبيه.' : "Erreur lors de l'envoi de l'alerte.");
    } finally {
      setTimeout(() => setEmergencyDisabled(false), 5000);
    }
  }, [sessionId, lang]);

  return (
    <PublicLayout>
      <div className={`chat-page${isRTL ? ' rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>

        {/* Topbar */}
        <div className="chat-topbar">
          <span className="chat-topbar-title">{t.title}</span>
          <span className="chat-topbar-badge">{t.badge}</span>
          <div className="chat-topbar-actions">
            <button className="lang-toggle-btn" onClick={toggleLang}>
              {lang === 'fr' ? '🇲🇦 AR' : '🇫🇷 FR'}
            </button>
            <button className="new-chat-btn" onClick={resetConversation}>{t.newBtn}</button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && !isTyping ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">🩺</div>
              <h2>{t.welcome}</h2>
              <p>{t.welcomeSub}</p>
              <div className="chat-suggestions">
                {t.suggestions.map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => handleSendMessage(s)}>
                    {s}
                  </button>
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
                      <div className={`msg-bubble${isRTL ? ' rtl' : ''}`}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          formatMessageWithLocation(msg.content)
                        )}
                        {msg.urgency && (
                          <span className="urgency-badge">
                            ⚠️ {lang === 'ar' ? 'طارئ' : 'Urgence'}
                          </span>
                        )}
                      </div>
                      <div className={`msg-footer${isRTL ? ' rtl' : ''}`}>
                        <span className="msg-time">{msg.time}</span>
                        {msg.role === 'assistant' && (
                          <button
                            className={`audio-play-btn${playingMsgIdx === i ? ' playing' : ''}`}
                            onClick={() => {
                              if (playingMsgIdx === i) {
                                cancel();
                                setPlayingMsgIdx(null);
                              } else {
                                cancel();
                                setPlayingMsgIdx(i);
                                speak(msg.content);
                                setTimeout(() => setPlayingMsgIdx(null), Math.min(msg.content.length * 55 + 1500, 30000));
                              }
                            }}
                          >
                            {playingMsgIdx === i ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="5" y="4" width="4" height="16" rx="1"/>
                                <rect x="15" y="4" width="4" height="16" rx="1"/>
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
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

        {/* Zone de saisie */}
        <div className="chat-input-area">
          <div className="chat-input-box">
            <button className="input-tool-btn" aria-label="Camera"><IconCamera /></button>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={listening ? t.recording : micLoading ? t.transcribing : t.placeholder}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isTyping || listening || micLoading}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <button
              className={`input-tool-btn mic-btn${listening ? ' mic-active' : ''}${micLoading ? ' mic-loading' : ''}`}
              onClick={(e) => { e.preventDefault(); toggleListening(); }}
              disabled={isTyping || micLoading}
            >
              <IconMic />
            </button>
            <button className="input-tool-btn location-btn" onClick={handleLocationClick} disabled={locLoading} title="Me localiser">
              {locLoading ? '⏳' : '📍'}
            </button>
            <button className="input-tool-btn emergency-btn" onClick={handleEmergency} disabled={emergencyDisabled} title="Alerte urgence">
              🚨
            </button>
            <button className="input-send-btn" onClick={() => handleSendMessage()} disabled={!input.trim() || isTyping}>
              <IconSend />
            </button>
          </div>

          {!locationSentInThisConversation && !locLoading && !locationSentRef.current && (
            <div className="location-prompt">{t.locationPrompt}</div>
          )}
          {locError && (
            <div className="location-error">
              {locError}{' '}
              <button onClick={() => window.location.reload()}>
                {isRTL ? 'إعادة تحميل' : 'Recharger'}
              </button>
            </div>
          )}
          <p className="chat-input-hint">{t.hint}</p>
        </div>

        {/* Section sauvegarde */}
        {messages.length > 0 && (
          <div className="save-section">
            {!isAuthenticated ? (
              <div className="save-prompt">
                <p>{t.savePrompt}</p>
                <div className="save-buttons">
                  <button onClick={() => navigate('/login')}>{t.login}</button>
                  <button onClick={() => navigate('/register')}>{t.register}</button>
                  <button className="save-btn" onClick={saveConsultation}>{t.save}</button>
                </div>
              </div>
            ) : (
              <button className="save-btn" onClick={saveConsultation}>{t.save}</button>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default PublicChatPage;