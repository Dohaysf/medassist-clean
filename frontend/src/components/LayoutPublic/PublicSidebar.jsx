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

const IconSettings = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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

/* ═══════════════════════════════════════ */
const PublicSidebar = () => {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('token');
  const [userName, setUserName] = useState('Utilisateur');
  const [collapsed, setCollapsed] = useState(false);

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

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside className={`public-sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* HEADER */}
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-logo-title">MedAssist</span>}
        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          <IconCollapse />
        </button>
      </div>

      {/* NAVIGATION PRINCIPALE */}
      <nav className="sidebar-nav">

        <button className="sidebar-nav-btn" onClick={() => navigate('/public/chat')}>
          <span className="nav-plus-icon">+</span>
          {!collapsed && <span>Nouvelle consultation</span>}
        </button>

        <button className="sidebar-nav-btn">
          <span className="nav-icon"><IconSearch /></span>
          {!collapsed && <span>Rechercher</span>}
        </button>

        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconHome /></span>
          {!collapsed && <span>Accueil</span>}
        </NavLink>

        <NavLink to="/public/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconChat /></span>
          {!collapsed && <span>Chat médical</span>}
        </NavLink>

        <NavLink to="/public/history" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconHistory /></span>
          {!collapsed && <span>Historique</span>}
        </NavLink>

        <NavLink to="/public/about" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconInfo /></span>
          {!collapsed && <span>À propos</span>}
        </NavLink>

        <NavLink to="/public/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconSettings /></span>
          {!collapsed && <span>Paramètres</span>}
        </NavLink>

      </nav>

      {/* DIVIDER */}
      <div className="sidebar-divider" />

      {/* FOOTER : AUTH BUTTONS EN BAS */}
      {!isAuthenticated ? (
        <div className="auth-section">
          <button onClick={() => navigate('/login')} className="auth-btn">
            <IconSignIn />
            {!collapsed && <span>Se connecter</span>}
          </button>
          <button onClick={() => navigate('/register')} className="auth-btn register-btn">
            <IconUserPlus />
            {!collapsed && <span>Créer un compte</span>}
          </button>
        </div>
      ) : (
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="profile-avatar">{userInitial}</div>
            {!collapsed && (
              <div className="profile-info">
                <div className="profile-name">{userName}</div>
                <div className="profile-plan">Patient</div>
              </div>
            )}
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