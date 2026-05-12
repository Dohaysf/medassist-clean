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
    FaUsers
} from 'react-icons/fa';
import './PatientSidebar.css';

const PatientSidebar = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentSessions, setRecentSessions] = useState([]);

    // Récupération des infos utilisateur depuis l'API
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

    // Récupération des sessions récentes
    useEffect(() => {
        if (!user) return;
        try {
            const userId = user._id || user.id || 'guest';
            const key = `chatSessions_${userId}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                const sorted = parsed
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .slice(0, 5);
                setRecentSessions(sorted);
            } else {
                setRecentSessions([]);
            }
        } catch (e) {
            console.error('Erreur lecture sessions locales:', e);
        }
    }, [user]);

    const getInitial = () => {
        if (!user || !user.name) return '?';
        const firstName = user.name.trim().split(' ')[0];
        return firstName.charAt(0).toUpperCase();
    };

    const getAvatarColor = (letter) => {
        const colors = [
            '#2EC5C0', '#7B61FF', '#FF9F4A', '#F05454', '#4B9F8C',
            '#E86F6F', '#6C5B7B', '#F8B400', '#3C8D7A', '#C06C84'
        ];
        const index = letter.charCodeAt(0) % colors.length;
        return colors[index];
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

    const newConsultation = () => {
        const newSessionId = Date.now().toString();
        try {
            let userId = 'guest';
            if (user) {
                if (user._id) userId = user._id;
                else if (user.id) userId = user.id;
            }
            const key = `chatSessions_${userId}`;
            const stored = localStorage.getItem(key);
            const sessions = stored ? JSON.parse(stored) : [];
            sessions.unshift({
                id: newSessionId,
                title: `Consultation du ${new Date().toLocaleDateString('fr-FR')}`,
                updatedAt: Date.now()
            });
            localStorage.setItem(key, JSON.stringify(sessions.slice(0, 20)));
        } catch (e) {
            console.error('Erreur sauvegarde session:', e);
        }
        localStorage.setItem('currentSessionId', newSessionId);
        navigate('/Patient/chat');
        window.location.reload();
    };

    const userInitial = getInitial();
    const avatarColor = getAvatarColor(userInitial);
    const displayName = user && user.name ? user.name : 'Utilisateur';

    return (
        <aside className="Patient-sidebar">
            {/* HEADER */}
            <div className="Patient-sidebar-logo">
                <h2>MedAssist</h2>
            </div>

            {/* NEW CHAT */}
            <button className="new-chat-btn" onClick={newConsultation}>
                <span className="plus-icon">+</span>
                Nouvelle consultation
            </button>

            {/* SCROLL AREA */}
            <div className="sidebar-content">
                {/* NAVIGATION */}
                <nav className="Patient-sidebar-nav">
                    <NavLink to="/Patient/chat" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaComments className="Patient-nav-icon" />
                        <span>Chat médical</span>
                    </NavLink>
                    <NavLink to="/Patient/patients" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaUsers className="Patient-nav-icon" />
                        <span>Mes patients</span>
                    </NavLink>
                    <NavLink to="/Patient/info" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaUserMd className="Patient-nav-icon" />
                        <span>Mon profil</span>
                    </NavLink>
                    <NavLink to="/Patient/history" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaHistory className="Patient-nav-icon" />
                        <span>Historique</span>
                    </NavLink>
                    <NavLink to="/Patient/eso" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaFileAlt className="Patient-nav-icon" />
                        <span>Résumés ESO</span>
                    </NavLink>
                    <NavLink to="/Patient/settings" className={({ isActive }) => isActive ? 'active' : ''}>
                        <FaCog className="Patient-nav-icon" />
                        <span>Paramètres</span>
                    </NavLink>
                </nav>

                {/* RECENTS */}
                <div className="sidebar-recents">
                    <div className="sidebar-section-label">Récents</div>
                    {recentSessions.length === 0 ? (
                        <div className="recent-item-empty">Aucune discussion récente</div>
                    ) : (
                        recentSessions.map(session => (
                            <div 
                                key={session.id} 
                                className="recent-item"
                                onClick={() => loadSession(session.id)}
                                title={session.title || 'Conversation'}
                            >
                                <div className="recent-item-title">{session.title || 'Consultation'}</div>
                                <div className="recent-item-date">
                                    {new Date(session.updatedAt).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* FOOTER */}
            <div className="Patient-sidebar-footer">
                <div className="user-info">
                    <div className="user-avatar" style={{ backgroundColor: avatarColor }}>
                        {!loading ? userInitial : '...'}
                    </div>
                    <span className="user-name">{displayName}</span>
                </div>
                <button onClick={handleLogout} className="Patient-logout-btn">
                    <FaSignOutAlt className="Patient-nav-icon" />
                    Déconnexion
                </button>
            </div>
        </aside>
    );
};

// Export de la fonction utilitaire
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