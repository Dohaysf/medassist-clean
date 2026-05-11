// frontend/src/pages/PublicChatPage/PublicChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicLayout from '../../../components/LayoutPublic/PublicLayout';
import useSpeechSynthesis from '../../../hooks/useSpeechSynthesis';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import ReactMarkdown from 'react-markdown';
import './PublicChatPage.css';

// ── Icônes ────────────────────────────────────────────────────────────────────
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

// ── Contenu multilingue ───────────────────────────────────────────────────────
const I18N = {
  fr: {
    title:       'Consultation médicale',
    badge:       'Assistant IA',
    newBtn:      '+ Nouveau',
    welcome:     'Bonjour, comment puis-je vous aider ?',
    welcomeSub:  'Décrivez vos symptômes et je vous fournirai des conseils adaptés.',
    placeholder: 'Décrivez vos symptômes…',
    recording:   'Enregistrement… Parlez maintenant',
    transcribing:'Transcription en cours…',
    hint:        'MedAssist ne remplace pas un avis médical professionnel.',
    savePrompt:  '💾 Sauvegardez cette conversation dans votre espace patient',
    login:       'Se connecter',
    register:    'Créer un compte',
    save:        '💾 Sauvegarder cette consultation',
    listen:      'Écouter',
    stop:        'Arrêter',
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
    welcome:     'مرحبًا، كيف يمكنني مساعدتك؟',
    welcomeSub:  'صف أعراضك وسأقدم لك النصائح المناسبة.',
    placeholder: 'صف أعراضك…',
    recording:   'جارٍ التسجيل… تحدث الآن',
    transcribing:'جارٍ التحويل…',
    hint:        'لا يُغني MedAssist عن الاستشارة الطبية المتخصصة.',
    savePrompt:  '💾 احفظ هذه المحادثة في مساحتك',
    login:       'تسجيل الدخول',
    register:    'إنشاء حساب',
    save:        '💾 حفظ هذه الاستشارة',
    listen:      'استمع',
    stop:        'إيقاف',
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

const PublicChatPage = () => {
  const navigate = useNavigate();

  // ── Langue ────────────────────────────────────────────────────────────────
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
  const t    = I18N[lang] || I18N.fr;
  const isRTL = lang === 'ar';

  const toggleLang = () => {
    const next = lang === 'fr' ? 'ar' : 'fr';
    setLang(next);
    localStorage.setItem('language', next);
  };

  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState('');
  const [isTyping,        setIsTyping]        = useState(false);
  const [sessionId,       setSessionId]       = useState(() => localStorage.getItem('publicSessionId') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [playingMsgIdx,   setPlayingMsgIdx]   = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const isTypingRef    = useRef(false);

  const { speak, cancel }                                            = useSpeechSynthesis();
  const { transcript, transcriptTs, listening, isLoading: micLoading, toggleListening } = useSpeechRecognition();

  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);

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

  // ── Sauvegarde locale ──────────────────────────────────────────────────────
  const saveToHistory = (userMessage, botResponse, isUrgent = false) => {
    const stored = localStorage.getItem('consultationHistory');
    const history = stored ? JSON.parse(stored) : [];
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      symptoms: userMessage.substring(0, 200),
      response: botResponse.substring(0, 300),
      urgency: isUrgent,
    });
    if (history.length > 100) history.pop();
    localStorage.setItem('consultationHistory', JSON.stringify(history));
    window.dispatchEvent(new Event('historyUpdate'));
  };

  // ── Sauvegarde MongoDB ─────────────────────────────────────────────────────
  const saveConsultation = useCallback(async () => {
    if (!sessionId)            { alert('❌ Aucune session en cours'); return; }
    if (!messages.length)      { alert('❌ Aucune conversation à sauvegarder'); return; }
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
      const res = await axios.post(
        'http://localhost:5000/api/chat/save-session',
        { sessionId, messages: messages.map(m => ({ role: m.role, content: m.content, time: m.time, urgency: m.urgency || false })) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert(lang === 'ar' ? '✅ تم حفظ الاستشارة!' : '✅ Consultation sauvegardée !');
        localStorage.removeItem('publicSessionId');
        localStorage.removeItem('pendingSaveSession');
        setSessionId(null);
        navigate('/patient/history');
      }
    } catch (err) {
      console.error(err);
      alert('❌ ' + ((err.response && err.response.data && err.response.data.error) ? err.response.data.error : err.message));
    }
  }, [sessionId, messages, isAuthenticated, lang, navigate]);

  useEffect(() => {
    const pending = localStorage.getItem('pendingSaveSession');
    if (pending && isAuthenticated) {
      localStorage.removeItem('pendingSaveSession');
      setTimeout(() => saveConsultation(), 500);
    }
  }, [isAuthenticated, saveConsultation]);

  // ── Envoi message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text = input) => {
    const trimmed = (text || '').trim();
    if (!trimmed || isTypingRef.current) return;

    let sid = sessionId;
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(sid);
    }

    setMessages(prev => [...prev, { role: 'user', content: trimmed, time: nowTime() }]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    try {
      const res = await axios.post('http://localhost:5000/api/chat', { message: trimmed, sessionId: sid });
      const reply    = res.data.reply || (lang === 'ar' ? 'جارٍ المعالجة…' : 'Je traite votre demande…');
      const isUrgent = res.data.urgency === true || res.data.severity === 'critique';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, time: nowTime(), urgency: isUrgent }]);
      saveToHistory(trimmed, reply, isUrgent);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: lang === 'ar' ? '❌ حدث خطأ. يرجى المحاولة مرة أخرى.' : '❌ Une erreur est survenue. Veuillez réessayer.',
        time: nowTime(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, sessionId, lang]);

  // ── Transcript vocal → envoi auto ─────────────────────────────────────────
  useEffect(() => {
    if (transcript && transcript.trim() && transcriptTs > 0) {
      sendMessage(transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptTs]);

  // ── Géolocalisation ────────────────────────────────────────────────────────
  const sendLocation = () => {
    if (!navigator.geolocation) { alert(lang === 'ar' ? 'الموقع غير مدعوم' : 'Géolocalisation non supportée'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await sendMessage(`Ma position: latitude ${pos.coords.latitude}, longitude ${pos.coords.longitude}`);
      },
      () => alert(lang === 'ar' ? 'تعذر تحديد الموقع' : "Impossible d'accéder à votre position")
    );
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const resetConversation = () => {
    const msg = lang === 'ar' ? 'مسح هذه المحادثة؟' : '⚠️ Effacer cette conversation ?';
    if (messages.length > 0 && window.confirm(msg)) {
      setMessages([]);
      cancel();
      setPlayingMsgIdx(null);
      const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newId);
      localStorage.setItem('publicSessionId', newId);
    }
  };

  return (
    <PublicLayout>
      <div className={`chat-page${isRTL ? ' rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ── Topbar ── */}
        <div className="chat-topbar">
          <span className="chat-topbar-title">{t.title}</span>
          <span className="chat-topbar-badge">{t.badge}</span>
          <div className="chat-topbar-actions">
            <button className="lang-toggle-btn" onClick={toggleLang} title="Changer de langue / تغيير اللغة">
              {lang === 'fr' ? '🇲🇦 AR' : '🇫🇷 FR'}
            </button>
            <button className="new-chat-btn" onClick={resetConversation}>{t.newBtn}</button>
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
                    <div className={`msg-bubble${isRTL ? ' rtl' : ''}`}>
                      {msg.role === 'assistant'
                        ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                        : msg.content}
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
                          title={playingMsgIdx === i ? t.stop : t.listen}
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
              ))}
              {isTyping && (
                <div className="msg-row assistant">
                  <div className="msg-avatar assistant">M</div>
                  <div className="msg-bubble" style={{ padding: 0 }}>
                    <div className="typing-indicator">
                      <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
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
            <button className="input-tool-btn location-btn" onClick={sendLocation} title="Me localiser">📍</button>
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
              title={listening ? t.stop : (isRTL ? 'انقر للإملاء' : 'Cliquez pour dicter')}
              onClick={(e) => { e.preventDefault(); toggleListening(); }}
              disabled={isTyping || micLoading}
            >
              <IconMic />
            </button>
            <button
              className="input-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
            >
              <IconSend />
            </button>
          </div>
          <p className="chat-input-hint">{t.hint}</p>
        </div>

        {/* ── Section sauvegarde ── */}
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
