// frontend/src/hooks/useSpeechRecognition.js
import { useState, useEffect, useRef } from 'react';

const useSpeechRecognition = () => {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const getLanguage = () => {
    const lang = localStorage.getItem('language') || 'fr';
    return lang === 'ar' ? 'ar' : 'fr-FR'; // 'ar' pour l'arabe standard
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition non supporté');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = getLanguage();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Erreur reconnaissance vocale', event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = getLanguage();
      setTranscript('');
      setListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  return { transcript, listening, startListening, stopListening };
};

export default useSpeechRecognition;