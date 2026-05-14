// frontend/src/components/LayoutPublic/PublicSidebar.jsx
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FaHome,
  FaComments,
  FaInfoCircle,
  FaUserPlus,
  FaSignInAlt,
  FaHistory,
  FaBookmark,
  FaCog,
} from 'react-icons/fa';
import './PublicSidebar.css';

/* ── SVG Icons outline (style Claude) ── */
const IconSearch = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconChat = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconHome = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconInfo = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconHistory = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
  </svg>
);

const IconBookmark = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconSettings = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconSignIn = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <polyline points="10 17 15 12 10 7"/>
    <line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);

const IconUserPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);

const IconCollapse = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

const IconDots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
  </svg>
);

const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ═══════════════════════════════════════ */
const PublicSidebar = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('token');
  const [userName, setUserName] = useState('Utilisateur');
  const [recentConversations, setRecentConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger les conversations récentes
  const loadRecentConversations = async () => {
    setLoading(true);
    try {
      let conversations = [];
      
      if (isAuthenticated) {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:5000/api/chat/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        conversations = response.data.map(conv => ({
          id: conv.sessionId,
          title: conv.title || 'Consultation médicale',
          date: conv.date,
          preview: conv.preview,
          messageCount: conv.messageCount,
          updatedAt: conv.date
        }));
      } else {
        const stored = localStorage.getItem('publicConversations');
        if (stored) {
          const parsed = JSON.parse(stored);
          conversations = parsed.map(conv => ({
            id: conv.sessionId,
            title: conv.title || 'Consultation médicale',
            date: conv.createdAt ? new Date(conv.createdAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
            preview: conv.messages[0]?.user?.substring(0, 100) || 'Aucun message',
            messageCount: conv.messageCount || conv.messages.length,
            updatedAt: conv.updatedAt
          }));
        }
        
        const currentSessionId = localStorage.getItem('publicSessionId');
        if (currentSessionId && !conversations.some(c => c.id === currentSessionId)) {
          conversations.unshift({
            id: currentSessionId,
            title: 'Consultation en cours',
            date: new Date().toLocaleDateString('fr-FR'),
            preview: 'Discussion en cours...',
            messageCount: 0
          });
        }
      }
      
      conversations.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(a.date);
        const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(b.date);
        return dateB - dateA;
      });
      
      setRecentConversations(conversations.slice(0, 8));
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      setRecentConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentConversations();
    
    const handleUpdate = () => {
      loadRecentConversations();
    };
    
    window.addEventListener('conversationsUpdate', handleUpdate);
    window.addEventListener('historyUpdate', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    
    return () => {
      window.removeEventListener('conversationsUpdate', handleUpdate);
      window.removeEventListener('historyUpdate', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isAuthenticated]);

  // Charger les infos utilisateur
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      axios.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data.name) {
          setUserName(res.data.name);
          localStorage.setItem('userName', res.data.name);
        }
      }).catch(() => {});
    } else {
      const storedName = localStorage.getItem('userName');
      if (storedName) setUserName(storedName);
    }
  }, [isAuthenticated]);

  // Charger une conversation
  const loadConversation = (conversationId) => {
    if (isAuthenticated) {
      localStorage.setItem('currentSessionId', conversationId);
      navigate('/patient/chat');
    } else {
      localStorage.setItem('publicSessionId', conversationId);
      navigate('/public/chat');
    }
    window.location.reload();
  };

  // Filtrer les conversations
  const filteredConversations = recentConversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.preview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside className="public-sidebar">

      {/* HEADER */}
      <div className="sidebar-header">
        <span className="sidebar-logo-title">MedAssist</span>
        <button className="sidebar-collapse-btn" aria-label="Réduire">
          <IconCollapse />
        </button>
      </div>

      {/* NAVIGATION PRINCIPALE */}
      <nav className="sidebar-nav">

        <button className="sidebar-nav-btn" onClick={() => navigate(isAuthenticated ? '/patient/chat' : '/public/chat')}>
          <span className="nav-plus-icon">+</span>
          <span>Nouvelle consultation</span>
        </button>

        {/* Recherche */}
        <div className="sidebar-search-wrapper">
          {showSearch ? (
            <div className="sidebar-search-active">
              <span className="search-icon"><IconSearch /></span>
              <input
                type="text"
                placeholder="Rechercher une consultation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="sidebar-search-input"
              />
              <button className="search-close-btn" onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}>
                <IconClose />
              </button>
            </div>
          ) : (
            <button className="search-trigger-btn" onClick={() => setShowSearch(true)}>
              <span className="nav-icon"><IconSearch /></span>
              <span>Rechercher</span>
            </button>
          )}
        </div>

        {/* Liens principaux */}
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconHome /></span>
          <span>Accueil</span>
        </NavLink>

        <NavLink to={isAuthenticated ? "/patient/chat" : "/public/chat"} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconChat /></span>
          <span>Chat médical</span>
        </NavLink>

        <NavLink to={isAuthenticated ? "/patient/history" : "/public/history"} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconHistory /></span>
          <span>Historique</span>
        </NavLink>

        <NavLink to="/public/saved" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconBookmark /></span>
          <span>Sauvegardés</span>
        </NavLink>

        <NavLink to="/public/about" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconInfo /></span>
          <span>À propos</span>
        </NavLink>

        <NavLink to="/public/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconSettings /></span>
          <span>Paramètres</span>
        </NavLink>

      </nav>

      <div className="sidebar-divider" />

      {/* RÉCENTS */}
      <div className="sidebar-recents">
        <span className="sidebar-section-label">Récents</span>
        <div className="recent-list">
          {loading ? (
            <div className="recent-loading">
              <span>Chargement...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="recent-empty">
              <span>{searchQuery ? 'Aucun résultat' : 'Aucune consultation récente'}</span>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className="recent-item"
                onClick={() => loadConversation(conv.id)}
              >
                <div className="recent-item-content">
                  <span className="recent-item-text">{conv.title}</span>
                  {conv.date && (
                    <span className="recent-item-date">
                      {conv.date.includes('Invalid') ? new Date().toLocaleDateString('fr-FR') : conv.date}
                    </span>
                  )}
                </div>
                <button className="recent-menu-btn" aria-label="Options" onClick={(e) => e.stopPropagation()}>
                  <IconDots />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FOOTER */}
      {!isAuthenticated ? (
        <div className="auth-section">
          <button onClick={() => navigate('/login')} className="auth-btn">
            <IconSignIn />
            <span>Se connecter</span>
          </button>
          <button onClick={() => navigate('/register')} className="auth-btn register-btn">
            <IconUserPlus />
            <span>Créer un compte</span>
          </button>
        </div>
      ) : (
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="profile-avatar">{userInitial}</div>
            <div className="profile-info">
              <div className="profile-name">{userName}</div>
              <div className="profile-plan">Patient</div>
            </div>
            <div className="profile-actions">
              <button className="profile-action-btn" aria-label="Télécharger">
                <IconDownload />
                <span className="profile-dot" />
              </button>
              <button className="profile-action-btn" aria-label="Menu">
                <IconChevron />
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};

export default PublicSidebar;