import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Sidebar.css';

/* ── SVG Icons ───────────────────────────────────────────── */
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

const IconCollapse = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const IconExpand = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

/* ── Composant ───────────────────────────────────────────── */
const Sidebar = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch le nombre de messages non lus — avec logs de diagnostic
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/admin/contacts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📬 contacts:', res.data.map(m => ({ name: m.name, read: m.read })));
      const count = res.data.filter(m => !m.read).length;
      console.log('🔴 unread count:', count);
      setUnreadCount(count);
    } catch (err) {
      console.error('Erreur fetch unread:', err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Écoute quand ContactPage marque un message comme lu
  useEffect(() => {
    const handleContactRead = () => {
      console.log('✅ contactRead event reçu → refetch');
      fetchUnreadCount();
    };
    window.addEventListener('contactRead', handleContactRead);
    return () => window.removeEventListener('contactRead', handleContactRead);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Header */}
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-logo-title">MedAssist</span>}
        {!collapsed && <span className="sidebar-badge">Admin</span>}
        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <IconExpand /> : <IconCollapse />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <NavLink to="/manager/chat" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><IconChat /></span>
          {!collapsed && <span>Chat médical</span>}
        </NavLink>

        <NavLink to="/manager/history" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><IconHistory /></span>
          {!collapsed && <span>Historique</span>}
        </NavLink>

        <NavLink to="/manager/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><IconStats /></span>
          {!collapsed && <span>Statistiques</span>}
        </NavLink>

        {/* Messages reçus — badge non lus */}
        <NavLink to="/manager/contacts" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><IconEnvelope /></span>
          {!collapsed && <span>Messages reçus</span>}
          {unreadCount > 0 && (
            <span className={`nav-unread-badge ${collapsed ? 'badge-collapsed' : ''}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/manager/settings" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon"><IconSettings /></span>
          {!collapsed && <span>Paramètres</span>}
        </NavLink>
      </nav>

      <div className="sidebar-divider" />

      {/* Footer */}
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <IconSignOut />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;