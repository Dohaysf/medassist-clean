// frontend/src/components/LayoutPatient/PatientChat/PatientChat.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { sendMessage as apiSendMessage } from '../../../services/api';
import useSpeechSynthesis from '../../../hooks/useSpeechSynthesis';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import useGeolocation from '../../../hooks/useGeolocation';
import './PatientChat.css';
import { generateSessionSummary } from '../../../components/LayoutPatient/PatientSidebar/PatientSidebar';
import ReactMarkdown from 'react-markdown';

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

// ── Contenu multilingue ────────────────────────────────────────────────────────
const I18N = {
  fr: {
    title:       'Consultation médicale',
    badge:       'Assistant IA',
    newBtn:      '+ Nouveau',
    welcome:     "Bonjour, je suis l'assistant médical. Décrivez votre situation.",
    welcomeSub:  'Décrivez vos symptômes et je vous fournirai des conseils adaptés.',
    placeholder: 'Décrivez vos symptômes…',
    recording:   'Enregistrement… Parlez maintenant',
    transcribing:'Transcription en cours…',
    hint:        'MedAssist ne remplace pas un avis médical professionnel.',
    locationPrompt: 'Partagez votre position pour une intervention plus rapide (optionnel)',
    suggestions: [
      "J'ai de la fièvre depuis hier",
      'Douleur thoracique légère',
      'Allergie aux arachides',
      'Blessure au genou',
    ],
  },
  ar: {
    title:       'الاستشارة الطبية',
    badge:       'مساعد ذكاء اصطناعي',
    newBtn:      '+ جديد',
    welcome:     'مرحبًا، أنا المساعد الطبي. يرجى وصف حالتك.',
    welcomeSub:  'صف أعراضك وسأقدم لك النصائح المناسبة.',
    placeholder: 'صف أعراضك…',
    recording:   'جارٍ التسجيل… تحدث الآن',
    transcribing:'جارٍ التحويل…',
    hint:        'لا يُغني MedAssist عن الاستشارة الطبية المتخصصة.',
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

const PatientChat = () => {
  const token = localStorage.getItem('token');

  // ── Langue (fr / ar) ────────────────────────────────────────────────────────
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  const t = I18N[lang] || I18N.fr;
  const isRTL = lang === 'ar';

  const toggleLang = () => {
    const next = lang === 'fr' ? 'ar' : 'fr';
    setLang(next);
    localStorage.setItem('language', next);
  };

  const [messages,    setMessages]    = useState([]);
  const [sessionId,   setSessionId]   = useState(() => localStorage.getItem('currentSessionId') || null);
  const [userId,      setUserId]      = useState(() => localStorage.getItem('userId') || null);
  const [input,       setInput]       = useState('');
  const [isTyping,    setIsTyping]    = useState(false);
  const [emergencyDisabled, setEmergencyDisabled] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  const { speak } = useSpeechSynthesis();
  const { transcript, transcriptTs, listening, isLoading: micLoading, toggleListening } = useSpeechRecognition();
  const { loading: locLoading, error: locError, getLocation, resetError } = useGeolocation();

  const locationSentRef = useRef(false);
  const [locationSentInThisConversation, setLocationSentInThisConversation] = useState(false);

  // ── Persistance session ────────────────────────────────────────────────────
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
          title: firstMessage.length > 45 ? firstMessage.substring(0, 45) + '...' : firstMessage,
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

  const saveSessionSummary = useCallback((sessionIdParam, esoSummary) => {
    const summary = generateSessionSummary(esoSummary);
    if (summary) {
      const uid = localStorage.getItem('userId') || 'guest';
      const key = `chatSessions_${uid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const sessions = JSON.parse(stored);
        const idx = sessions.findIndex(s => s.id === sessionIdParam);
        if (idx !== -1) {
          sessions[idx].title = summary;
          sessions[idx].updatedAt = Date.now();
          localStorage.setItem(key, JSON.stringify(sessions));
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      const tk = localStorage.getItem('token');
      if (!tk) return;
      import('axios').then(({ default: ax }) => {
        ax.get('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${tk}` }
        }).then(res => {
          const id = res.data._id || res.data.id;
          if (id) { localStorage.setItem('userId', id); setUserId(id); }
        }).catch(() => {});
      });
    }
  }, [userId]);

  useEffect(() => {
    if (!sessionId && !localStorage.getItem('currentSessionId')) {
      const newId = Date.now().toString();
      setSessionId(newId);
      localStorage.setItem('currentSessionId', newId);
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current && messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sessionIdRef = useRef(sessionId);
  const isTypingRef  = useRef(isTyping);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { isTypingRef.current  = isTyping;  }, [isTyping]);

  // ── Envoi central ──────────────────────────────────────────────────────────
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
      localStorage.setItem('currentSessionId', sid);
    }

    try {
      const data = await apiSendMessage(trimmed, sid);
      if (data.sessionId) {
        setSessionId(data.sessionId);
        sessionIdRef.current = data.sessionId;
        localStorage.setItem('currentSessionId', data.sessionId);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, time: nowTime() }]);
      speak(data.reply);
      saveSessionToHistory(data.sessionId || sid, trimmed);
      if (data.esoSummary) saveSessionSummary(data.sessionId || sid, data.esoSummary);
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
  }, [speak, saveSessionToHistory, saveSessionSummary, lang]);

  // ── Transcript vocal → envoi auto ─────────────────────────────────────────
  useEffect(() => {
    if (transcript && transcript.trim() && transcriptTs > 0) {
      sendText(transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptTs]);

  const handleSendMessage = useCallback(async (text = input) => {
    await sendText(text);
  }, [input, sendText]);

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

  const resetConversation = useCallback(async () => {
    if (sessionId) {
      try { await axios.post('http://localhost:5000/api/chat/reset-session', { sessionId }); }
      catch (err) { console.error(err); }
    }
    const newId = Date.now().toString();
    setMessages([]);
    setSessionId(newId);
    localStorage.setItem('currentSessionId', newId);
    setInput('');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    locationSentRef.current = false;
    setLocationSentInThisConversation(false);
    resetError();
    setEmergencyDisabled(false);
  }, [sessionId, resetError]);

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
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(lang === 'ar' ? 'تم إرسال التنبيه.' : 'Alerte envoyée.');
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply, time: nowTime() }]);
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'خطأ في إرسال التنبيه.' : "Erreur lors de l'envoi de l'alerte.");
    } finally {
      setTimeout(() => setEmergencyDisabled(false), 5000);
    }
  }, [sessionId, token, lang]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  return (
    <div className={`chat-page${isRTL ? ' rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Topbar ── */}
      <div className="chat-topbar">
        <span className="chat-topbar-title">{t.title}</span>
        <span className="chat-topbar-badge">{t.badge}</span>
        <div className="chat-topbar-actions">
          {/* Bouton langue FR/AR */}
          <button className="lang-toggle-btn" onClick={toggleLang} title="Changer de langue / تغيير اللغة">
            {lang === 'fr' ? '🇲🇦 AR' : '🇫🇷 FR'}
          </button>
          <button className="new-chat-btn" onClick={resetConversation} title={t.newBtn}>
            {t.newBtn}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
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
                    </div>
                    <div className={`msg-time${isRTL ? ' rtl' : ''}`}>{msg.time}</div>
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

      {/* ── Zone de saisie ── */}
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
            title={listening ? (isRTL ? 'انقر للإيقاف' : 'Cliquez pour arrêter') : (isRTL ? 'انقر للإملاء' : 'Cliquez pour dicter')}
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
    </div>
  );
};

export default PatientChat;