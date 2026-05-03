// frontend/src/hooks/useSpeechSynthesis.js
import { useState, useEffect } from 'react';

const useSpeechSynthesis = () => {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
  }, []);

  const detectLanguage = (text) => {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text) ? 'ar' : 'fr';
  };

  const speak = (text) => {
    const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';
    if (!supported || !voiceEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = detectLanguage(text);
    utterance.lang = lang === 'ar' ? 'ar-EG' : 'fr-FR';
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return { speak, cancel, speaking, supported };
};

export default useSpeechSynthesis;