// frontend/src/hooks/useSpeechSynthesis.js
// ── gTTS (Google Text-to-Speech via microservice Python) ─────────────────────
import { useState, useCallback } from 'react';

const GTTS_ENDPOINT = 'http://localhost:8002/speak';

const useSpeechSynthesis = () => {
    const [speaking, setSpeaking] = useState(false);
    const supported = true; // gTTS fonctionne sur tous les navigateurs

    const audioRef = { current: null };

    const detectLanguage = (text) => {
        const arabicPattern = /[\u0600-\u06FF]/;
        return arabicPattern.test(text) ? 'ar' : 'fr';
    };

    const cancel = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        setSpeaking(false);
    }, []);

    const speak = useCallback(async(text) => {
        const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';
        if (!voiceEnabled || !text || !text.trim()) return;

        // Annuler l'audio en cours si existant
        cancel();

        const lang = detectLanguage(text);

        try {
            setSpeaking(true);

            const response = await fetch(GTTS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text.trim().substring(0, 500), // limite gTTS
                    lang: lang,
                }),
            });

            if (!response.ok) throw new Error(`gTTS error ${response.status}`);

            // Convertir la réponse en blob audio et jouer
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                audioRef.current = null;
                setSpeaking(false);
            };

            audio.onerror = () => {
                URL.revokeObjectURL(url);
                audioRef.current = null;
                setSpeaking(false);
            };

            await audio.play();
        } catch (err) {
            console.error('Erreur gTTS:', err.message);
            setSpeaking(false);

            // Fallback : Web Speech API si gTTS échoue
            if ('speechSynthesis' in window) {
                console.warn('🔄 Fallback sur Web Speech API');
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = lang === 'ar' ? 'ar-SA' : 'fr-FR';
                utterance.onstart = () => setSpeaking(true);
                utterance.onend = () => setSpeaking(false);
                utterance.onerror = () => setSpeaking(false);
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [cancel]);

    return { speak, cancel, speaking, supported };
};

export default useSpeechSynthesis;