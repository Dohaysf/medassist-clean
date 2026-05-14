// src/i18n/useTranslation.js
import { useState, useEffect } from 'react';
import translations from '../../src/translation';

const useTranslation = () => {
    const [language, setLanguage] = useState(
        () => localStorage.getItem('language') || 'fr'
    );

    useEffect(() => {
        // Écouter les changements de langue depuis PublicSettingsPage
        const handleLanguageChange = (e) => {
            setLanguage(e.detail.language);
        };
        window.addEventListener('languageChange', handleLanguageChange);
        return () => window.removeEventListener('languageChange', handleLanguageChange);
    }, []);

    const t = (page) => {
        if (translations[language]) {
            return translations[language][page];
        } else {
            return translations['fr'][page];
        }
    };
    return { language, t };
};

export default useTranslation;