import { NavLink, useNavigate } from 'react-router-dom';
import { 
  FaComments, 
  FaHistory, 
  FaChartBar, 
  FaCog, 
  FaSignOutAlt, 
  FaEnvelope,
  FaUsers
} from 'react-icons/fa';
import './Sidebar.css';

/* ── SVG Icons outline (style Claude) ── */
const IconHome = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconChat = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconHistory = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
  </svg>
);

const IconStats = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconEnvelope = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconSettings = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconSignOut = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  return (
    <aside className="admin-sidebar">
      {/* HEADER */}
      <div className="sidebar-header">
        <span className="sidebar-logo-title">MedAssist</span>
        <span className="sidebar-badge">Admin</span>
      </div>

      {/* NAVIGATION PRINCIPALE */}
      <nav className="sidebar-nav">
        <NavLink to="/manager/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconChat /></span>
          <span>Chat médical</span>
        </NavLink>

        <NavLink to="/manager/history" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconHistory /></span>
          <span>Historique</span>
        </NavLink>

        <NavLink to="/manager/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconStats /></span>
          <span>Statistiques</span>
        </NavLink>

        <NavLink to="/manager/contacts" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconEnvelope /></span>
          <span>Messages reçus</span>
        </NavLink>

        <NavLink to="/manager/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon"><IconSettings /></span>
          <span>Paramètres</span>
        </NavLink>
      </nav>

      <div className="sidebar-divider" />

      {/* FOOTER */}
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <IconSignOut />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;