// frontend/src/hooks/useSpeechRecognition.js
// ── Whisper local via MediaRecorder ──────────────────────────────────────────
import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

const WHISPER_ENDPOINT = 'http://localhost:5000/api/chat/transcribe';

const useSpeechRecognition = () => {
    const [transcript, setTranscript] = useState('');
    const [transcriptTs, setTranscriptTs] = useState(0);
    const [listening, setListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const listeningRef = useRef(false);
    const timeoutRef = useRef(null);

    // ── Envoi à Whisper ─────────────────────────────────────────────────────────
    const sendToWhisper = useCallback(async(blob) => {
        if (!blob || blob.size < 1000) {
            console.warn('Audio trop court, ignoré');
            setIsLoading(false);
            return;
        }
        console.log(`📤 Envoi Whisper: ${blob.size} bytes [${blob.type}]`);
        setIsLoading(true);
        try {
            const formData = new FormData();
            // Détecter l'extension depuis le type MIME
            const ext = blob.type.includes('mp4') ? 'mp4' :
                blob.type.includes('ogg') ? 'ogg' :
                blob.type.includes('wav') ? 'wav' :
                'webm';
            formData.append('audio', blob, `recording.${ext}`);
            formData.append('language', localStorage.getItem('language') || 'fr');

            const token = localStorage.getItem('token');
            const res = await axios.post(WHISPER_ENDPOINT, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                timeout: 60000,
            });

            const text = (res.data.transcript || '').trim();
            console.log(`✅ Transcrit: "${text}"`);
            if (text) {
                setTranscript(text);
                setTranscriptTs(Date.now());
            }
        } catch (err) {
            console.error('Erreur Whisper:', err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Arrêt enregistrement ────────────────────────────────────────────────────
    const stopRecording = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        listeningRef.current = false;
        setListening(false);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop(); // déclenche onstop → sendToWhisper
        }
    }, []);

    // ── Démarrage enregistrement ────────────────────────────────────────────────
    const startRecording = useCallback(async() => {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                    channelCount: 1,
                },
            });
        } catch (err) {
            console.error('Micro refusé:', err);
            alert("Accès au microphone refusé. Vérifiez les permissions Edge.");
            return;
        }

        streamRef.current = stream;
        chunksRef.current = [];

        // Choisir le meilleur format supporté
        const mimeType = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
        ].find(t => MediaRecorder.isTypeSupported(t)) || '';

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                chunksRef.current.push(e.data);
                console.log(`🎵 Chunk: ${e.data.size} bytes`);
            }
        };

        recorder.onstop = () => {
            // Libérer le micro
            stream.getTracks().forEach(t => t.stop());
            streamRef.current = null;

            const totalSize = chunksRef.current.reduce((s, c) => s + c.size, 0);
            console.log(`📊 Total audio: ${totalSize} bytes`);

            const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
            chunksRef.current = [];
            sendToWhisper(blob);
        };

        recorder.start(250); // chunk toutes les 250ms
        listeningRef.current = true;
        setListening(true);
        setTranscript('');
        console.log(`🎙️ Enregistrement démarré [${mimeType || 'défaut'}]`);

        // Arrêt auto après 15s
        timeoutRef.current = setTimeout(() => {
            if (listeningRef.current) {
                console.log('⏱️ Arrêt automatique (15s)');
                stopRecording();
            }
        }, 15000);
    }, [sendToWhisper, stopRecording]);

    // ── Toggle ──────────────────────────────────────────────────────────────────
    const toggleListening = useCallback(() => {
        if (listeningRef.current) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [startRecording, stopRecording]);

    return { transcript, transcriptTs, listening, isLoading, toggleListening };
};

export default useSpeechRecognition;