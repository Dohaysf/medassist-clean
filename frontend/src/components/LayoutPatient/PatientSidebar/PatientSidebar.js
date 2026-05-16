// frontend/src/components/LayoutPatient/PatientSidebar/PatientSidebar.jsx
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    FaComments,
    FaUserMd,
    FaHistory,
    FaFileAlt,
    FaCog,
    FaSignOutAlt,
} from 'react-icons/fa';
import translations from '../../../translation'; // ← chemin correct
import './PatientSidebar.css';

// ─── Icônes SVG ───────────────────────────────────────────────
const IconSearch = () => ( <
    svg width = "17"
    height = "17"
    viewBox = "0 0 24 24"
    fill = "none"
    stroke = "currentColor"
    strokeWidth = "1.8"
    strokeLinecap = "round"
    strokeLinejoin = "round" >
    <
    circle cx = "11"
    cy = "11"
    r = "8" / >
    <
    line x1 = "21"
    y1 = "21"
    x2 = "16.65"
    y2 = "16.65" / >
    <
    /svg>
);

const IconClose = () => ( <
    svg width = "14"
    height = "14"
    viewBox = "0 0 24 24"
    fill = "none"
    stroke = "currentColor"
    strokeWidth = "2"
    strokeLinecap = "round"
    strokeLinejoin = "round" >
    <
    line x1 = "18"
    y1 = "6"
    x2 = "6"
    y2 = "18" / >
    <
    line x1 = "6"
    y1 = "6"
    x2 = "18"
    y2 = "18" / >
    <
    /svg>
);

const IconCollapse = () => ( <
    svg width = "16"
    height = "16"
    viewBox = "0 0 24 24"
    fill = "none"
    stroke = "currentColor"
    strokeWidth = "1.8"
    strokeLinecap = "round"
    strokeLinejoin = "round" >
    <
    rect x = "3"
    y = "3"
    width = "18"
    height = "18"
    rx = "2" / >
    <
    line x1 = "9"
    y1 = "3"
    x2 = "9"
    y2 = "21" / >
    <
    /svg>
);

const IconExpand = () => ( <
    svg width = "16"
    height = "16"
    viewBox = "0 0 24 24"
    fill = "none"
    stroke = "currentColor"
    strokeWidth = "1.8"
    strokeLinecap = "round"
    strokeLinejoin = "round" >
    <
    rect x = "3"
    y = "3"
    width = "18"
    height = "18"
    rx = "2" / >
    <
    line x1 = "15"
    y1 = "3"
    x2 = "15"
    y2 = "21" / >
    <
    /svg>
);

// ─── Composant principal ─────────────────────────────────────
const PatientSidebar = () => {
        const navigate = useNavigate();

        // ======================== LANGUE ========================
        const [lang, setLang] = useState(() => localStorage.getItem('language') || 'fr');
        const t = (translations[lang] || translations.fr).sidebar;
        const isRTL = lang === 'ar';

        useEffect(() => {
            const handleLangChange = (e) => {
                let newLang;
                if (e.detail && e.detail.language) {
                    newLang = e.detail.language;
                } else if (localStorage.getItem('language')) {
                    newLang = localStorage.getItem('language');
                } else {
                    newLang = 'fr';
                }
                setLang(newLang);
            };
            window.addEventListener('languageChange', handleLangChange);
            return () => window.removeEventListener('languageChange', handleLangChange);
        }, []);

        // ======================== THÈME ==========================
        const [theme, setTheme] = useState(() => {
            try {
                const saved = JSON.parse(localStorage.getItem('patientSettings'));
                if (saved && saved.theme) return saved.theme;
            } catch {}
            if (document.body.classList.contains('dark-mode')) return 'dark';
            return 'light';
        });

        useEffect(() => {
            const handleThemeChange = (e) => {
                let incoming = 'light';
                if (e.detail && e.detail.theme) incoming = e.detail.theme;
                if (incoming === 'auto') {
                    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                } else {
                    setTheme(incoming);
                }
            };
            window.addEventListener('themeChange', handleThemeChange);
            return () => window.removeEventListener('themeChange', handleThemeChange);
        }, []);

        const resolvedTheme = theme === 'auto' ?
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
            theme;

        // ======================== ÉTATS ==========================
        const [user, setUser] = useState(null);
        const [loading, setLoading] = useState(true);
        const [recentSessions, setRecentSessions] = useState([]);
        const [searchQuery, setSearchQuery] = useState('');
        const [showSearch, setShowSearch] = useState(false);
        const [collapsed, setCollapsed] = useState(false);

        const loadRecentSessions = () => {
            if (!user) return;
            try {
                const userId = user._id || user.id || 'guest';
                const key = `chatSessions_${userId}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const sorted = parsed.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
                    setRecentSessions(sorted);
                } else {
                    setRecentSessions([]);
                }
            } catch (e) {
                console.error('Erreur lecture sessions locales:', e);
                setRecentSessions([]);
            }
        };

        useEffect(() => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            axios.get('http://localhost:5000/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                setUser(res.data);
                setLoading(false);
                const uid = res.data._id || res.data.id;
                if (uid) localStorage.setItem('userId', uid);
            }).catch(err => {
                console.error('Erreur chargement profil sidebar:', err);
                setLoading(false);
            });
        }, []);

        useEffect(() => {
            if (user) loadRecentSessions();
        }, [user]);

        useEffect(() => {
            const handleUpdate = () => loadRecentSessions();
            window.addEventListener('conversationsUpdate', handleUpdate);
            window.addEventListener('historyUpdate', handleUpdate);
            return () => {
                window.removeEventListener('conversationsUpdate', handleUpdate);
                window.removeEventListener('historyUpdate', handleUpdate);
            };
        }, [user]);

        const getInitial = () => {
            if (!user || !user.name) return '?';
            return user.name.trim().split(' ')[0].charAt(0).toUpperCase();
        };

        const getAvatarColor = (letter) => {
            const colors = [
                '#2EC5C0', '#7B61FF', '#FF9F4A', '#F05454', '#4B9F8C',
                '#E86F6F', '#6C5B7B', '#F8B400', '#3C8D7A', '#C06C84',
            ];
            return colors[letter.charCodeAt(0) % colors.length];
        };

        const handleLogout = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            window.location.href = '/login';
        };

        const loadSession = (sessionId) => {
            localStorage.setItem('currentSessionId', sessionId);
            navigate('/Patient/chat');
            window.location.reload();
        };

        const newConsultation = async() => {
            const newSessionId = Date.now().toString();
            try {
                await axios.post('http://localhost:5000/api/chat/reset-session', {
                    sessionId: newSessionId,
                    reset: true,
                });
            } catch (err) {
                console.error('Erreur reset session:', err);
            }
            try {
                let userId = 'guest';
                if (user) userId = user._id || user.id || 'guest';
                const key = `chatSessions_${userId}`;
                const stored = localStorage.getItem(key);
                const sessions = stored ? JSON.parse(stored) : [];
                const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR';
                sessions.unshift({
                    id: newSessionId,
                    title: `${t.medicalConsultation || 'Consultation médicale'} ${new Date().toLocaleDateString(locale)}`,
                    updatedAt: Date.now(),
                    messageCount: 0,
                });
                localStorage.setItem(key, JSON.stringify(sessions.slice(0, 20)));
                window.dispatchEvent(new Event('conversationsUpdate'));
            } catch (e) {
                console.error('Erreur sauvegarde session:', e);
            }
            localStorage.setItem('currentSessionId', newSessionId);
            navigate('/Patient/chat');
            window.location.reload();
        };

        const filteredSessions = recentSessions.filter(s =>
            s.title ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : false
        );

        const userInitial = getInitial();
        const avatarColor = getAvatarColor(userInitial);
        const displayName = (user && user.name) ? user.name : (t.user || 'Utilisateur');

        // ======================== RENDU ===========================
        return ( <
                aside className = { `Patient-sidebar ${resolvedTheme}-mode ${collapsed ? 'collapsed' : ''} ${isRTL ? 'rtl' : ''}` }
                dir = { isRTL ? 'rtl' : 'ltr' } > { /* Header */ } <
                div className = "Patient-sidebar-header" > {!collapsed && < h2 > MedAssist < /h2>} <
                    button className = "sidebar-collapse-btn"
                    onClick = {
                        () => setCollapsed(!collapsed)
                    } > { collapsed ? < IconExpand / > : < IconCollapse / > } <
                    /button> < /
                    div >

                    { /* Nouvelle consultation */ } <
                    button className = "new-chat-btn"
                    onClick = { newConsultation } >
                    <
                    span className = "plus-icon" > + < /span> {!collapsed && < span > { t.newConsultation || 'Nouvelle consultation' } < /span >
                } < /
                button >

                <
                div className = "sidebar-content" > { /* Recherche */ } {
                    !collapsed && ( <
                        div className = "sidebar-search-wrapper"
                        style = {
                            { padding: '0 6px', marginBottom: '8px' }
                        } > {
                            showSearch ? ( <
                                div className = "sidebar-search-active"
                                style = {
                                    { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.06)', borderRadius: '8px' }
                                } >
                                <
                                span style = {
                                    { opacity: 0.55 }
                                } > < IconSearch / > < /span> <
                                input type = "text"
                                placeholder = { t.searchPlaceholder || 'Rechercher une consultation...' }
                                value = { searchQuery }
                                onChange = {
                                    (e) => setSearchQuery(e.target.value)
                                }
                                autoFocus dir = { isRTL ? 'rtl' : 'ltr' }
                                style = {
                                    { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.85rem' }
                                }
                                /> <
                                button className = "search-close-btn"
                                onClick = {
                                    () => {
                                        setShowSearch(false);
                                        setSearchQuery('');
                                    }
                                }
                                style = {
                                    { background: 'none', border: 'none', cursor: 'pointer' }
                                } >
                                <
                                IconClose / >
                                <
                                /button> < /
                                div >
                            ) : ( <
                                button className = "sidebar-nav-btn"
                                onClick = {
                                    () => setShowSearch(true)
                                }
                                style = {
                                    { display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 14px', margin: '0 6px', borderRadius: '8px', width: 'calc(100% - 12px)', background: 'transparent', border: 'none', cursor: 'pointer' }
                                } >
                                <
                                span className = "nav-icon"
                                style = {
                                    { opacity: 0.55 }
                                } > < IconSearch / > < /span> <
                                span > { t.search || 'Rechercher' } < /span> < /
                                button >
                            )
                        } <
                        /div>
                    )
                }

                { /* Navigation */ } <
                nav className = "Patient-sidebar-nav" >
                <
                NavLink to = "/Patient/chat"
                className = {
                    ({ isActive }) => isActive ? 'active' : ''
                } >
                <
                FaComments className = "Patient-nav-icon" / > {!collapsed && < span > { t.medicalChat || 'Chat médical' } < /span>} < /
                    NavLink > <
                    NavLink to = "/Patient/info"
                    className = {
                        ({ isActive }) => isActive ? 'active' : ''
                    } >
                    <
                    FaUserMd className = "Patient-nav-icon" / > {!collapsed && < span > { t.myProfile || 'Mon profil' } < /span>} < /
                        NavLink > <
                        NavLink to = "/Patient/history"
                        className = {
                            ({ isActive }) => isActive ? 'active' : ''
                        } >
                        <
                        FaHistory className = "Patient-nav-icon" / > {!collapsed && < span > { t.history || 'Historique' } < /span>} < /
                            NavLink > <
                            NavLink to = "/Patient/eso"
                            className = {
                                ({ isActive }) => isActive ? 'active' : ''
                            } >
                            <
                            FaFileAlt className = "Patient-nav-icon" / > {!collapsed && < span > { t.esoSummaries || 'Résumés ESO' } < /span>} < /
                                NavLink > <
                                NavLink to = "/Patient/settings"
                                className = {
                                    ({ isActive }) => isActive ? 'active' : ''
                                } >
                                <
                                FaCog className = "Patient-nav-icon" / > {!collapsed && < span > { t.settings || 'Paramètres' } < /span>} < /
                                    NavLink > <
                                    /nav>

                                    { /* Sessions récentes */ } {
                                        !collapsed && ( <
                                                div className = "sidebar-recents" >
                                                <
                                                div className = "sidebar-section-label" > { t.recents || 'Récents' } < /div> {
                                                filteredSessions.length === 0 ? ( <
                                                    div className = "recent-item-empty" > { searchQuery ? (t.noResults || 'Aucun résultat') : (t.noRecent || 'Aucune discussion récente') } <
                                                    /div>
                                                ) : (
                                                    filteredSessions.map(session => ( <
                                                        div key = { session.id }
                                                        className = "recent-item"
                                                        onClick = {
                                                            () => loadSession(session.id)
                                                        }
                                                        title = { session.title } >
                                                        <
                                                        div className = "recent-item-content" >
                                                        <
                                                        div className = "recent-item-title" > { session.title || t.medicalConsultation || 'Consultation' } < /div> <
                                                        div className = "recent-item-date" > {
                                                            new Date(session.updatedAt).toLocaleDateString(
                                                                lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
                                                            )
                                                        } <
                                                        /div> < /
                                                        div > <
                                                        button className = "recent-menu-btn"
                                                        onClick = {
                                                            (e) => e.stopPropagation()
                                                        } >
                                                        <
                                                        svg width = "12"
                                                        height = "12"
                                                        viewBox = "0 0 24 24"
                                                        fill = "none"
                                                        stroke = "currentColor"
                                                        strokeWidth = "2" >
                                                        <
                                                        circle cx = "5"
                                                        cy = "12"
                                                        r = "1" / >
                                                        <
                                                        circle cx = "12"
                                                        cy = "12"
                                                        r = "1" / >
                                                        <
                                                        circle cx = "19"
                                                        cy = "12"
                                                        r = "1" / >
                                                        <
                                                        /svg> < /
                                                        button > <
                                                        /div>
                                                    ))
                                                )
                                            } <
                                            /div>
                                    )
                                } <
                                /div>

                                { /* Footer */ } <
                                div className = "Patient-sidebar-footer" >
                                <
                                div className = "user-info" >
                                <
                                div className = "user-avatar"
                                style = {
                                    { backgroundColor: avatarColor }
                                } > {!loading ? userInitial : '...' } <
                                /div> {!collapsed && < span className = "user-name" > { displayName } < /span >
                            } < /
                            div > <
                            button onClick = { handleLogout }
                            className = "Patient-logout-btn" >
                            <
                            FaSignOutAlt className = "Patient-nav-icon" / > {!collapsed && < span > { t.logout || 'Déconnexion' } < /span>} < /
                                button > <
                                /div> < /
                                aside >
                            );
                        };

                        // ─── Export utilitaire ─────────────────────────────────────
                        export const generateSessionSummary = (esoSummary) => {
                            if (!esoSummary) return null;
                            const parts = [];
                            if (esoSummary.symptom) parts.push(esoSummary.symptom);
                            if (esoSummary.bodyPart) parts.push(esoSummary.bodyPart);
                            if (esoSummary.duration) parts.push(esoSummary.duration);
                            if (esoSummary.age) parts.push(`${esoSummary.age} ans`);
                            if (parts.length === 0) return null;
                            return parts.join(' • ').substring(0, 60);
                        };

                        export default PatientSidebar;