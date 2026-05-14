import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useTranslation from '../../hooks/useTranslation';

import './PublicSidebar.css';

/* ── SVG Icons ── */
const IconSearch = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconChat = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconHome = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconInfo = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconHistory = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
  </svg>
);

const IconSettings = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82" />
  </svg>
);

const PublicSidebar = () => {

  const navigate = useNavigate();

  const { t } = useTranslation();
  const T = t('sidebar');

  const isAuthenticated = !!localStorage.getItem('token');

  const [userName, setUserName] = useState(T.user);

  const [recentConversations, setRecentConversations] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');

  const [showSearch, setShowSearch] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadRecentConversations = async () => {

    setLoading(true);

    try {

      let conversations = [];

      if (isAuthenticated) {

        const token = localStorage.getItem('token');

        const response = await axios.get(
          'http://localhost:5000/api/chat/history',
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        conversations = response.data.map((conv) => (
          {
            id: conv.sessionId,
            title: conv.title || T.medicalConsultation,
            date: conv.date,
            preview: conv.preview,
            messageCount: conv.messageCount,
            updatedAt: conv.date
          }
        ));

      } else {

        const stored = localStorage.getItem('publicConversations');

        if (stored) {

          const parsed = JSON.parse(stored);

          conversations = parsed.map((conv) => ({
            id: conv.sessionId,
            title: conv.title || T.medicalConsultation,

           ية:
              conv.createdAt
                ? new Date(conv.createdAt).toLocaleDateString()
                : new Date().toLocaleDateString(),

            preview:
              conv.messages[0]?.user?.substring(0, 100) ||
              T.noMessage,

            messageCount:
              conv.messageCount || conv.messages.length,

            updatedAt: conv.updatedAt
          }));
        }
      }

      setRecentConversations(conversations.slice(0, 8));

    } catch (error) {

      console.error(error);
      setRecentConversations([]);

    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentConversations();
  }, [isAuthenticated]);

  /* fermeture auto search */
  useEffect(() => {

    if (!isAuthenticated && showSearch) {

      const timer = setTimeout(() => {
        setShowSearch(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

  }, [showSearch, isAuthenticated]);

  const filteredConversations = recentConversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.preview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="public-sidebar">

      {/* HEADER */}
      <div className="sidebar-header">

        <span className="sidebar-logo-title">
          MedAssist
        </span>

      </div>

      {/* NAV */}
      <nav className="sidebar-nav">

        <button
          className="sidebar-nav-btn"
          onClick={() =>
            navigate(
              isAuthenticated
                ? '/patient/chat'
                : '/public/chat'
            )
          }
        >
          <span className="nav-plus-icon">+</span>

          <span>{T.newConsultation}</span>

        </button>

        {/* SEARCH */}
        <div className="sidebar-search-wrapper">

          {showSearch ? (

            <div className="sidebar-search-active">

              <span className="search-icon">
                <IconSearch />
              </span>

              <input
                type="text"
                placeholder={
                  isAuthenticated
                    ? T.searchPlaceholder
                    : 'Veuillez vous connecter'
                }
                value={
                  isAuthenticated
                    ? searchQuery
                    : ''
                }
                onChange={(e) => {

                  if (isAuthenticated) {
                    setSearchQuery(e.target.value);
                  }

                }}
                autoFocus
                readOnly={!isAuthenticated}
                className="sidebar-search-input"
              />

            </div>

          ) : (

            <button
              className="search-trigger-btn"
              onClick={() => setShowSearch(true)}
            >

              <span className="nav-icon">
                <IconSearch />
              </span>

              <span>{T.search}</span>

            </button>

          )}

        </div>

        {/* LINKS */}

        <NavLink to="/">

          <span className="nav-icon">
            <IconHome />
          </span>

          <span>{T.home}</span>

        </NavLink>

        <NavLink
          to={
            isAuthenticated
              ? '/patient/chat'
              : '/public/chat'
          }
        >

          <span className="nav-icon">
            <IconChat />
          </span>

          <span>{T.medicalChat}</span>

        </NavLink>

        <NavLink
          to={
            isAuthenticated
              ? '/patient/history'
              : '/public/history'
          }
        >

          <span className="nav-icon">
            <IconHistory />
          </span>

          <span>{T.history}</span>

        </NavLink>

        <NavLink to="/public/about">

          <span className="nav-icon">
            <IconInfo />
          </span>

          <span>{T.about}</span>

        </NavLink>

        <NavLink to="/public/settings">

          <span className="nav-icon">
            <IconSettings />
          </span>

          <span>{T.settings}</span>

        </NavLink>

      </nav>

      {/* FOOTER */}
      {!isAuthenticated ? (

        <div className="auth-section">

          <button
            onClick={() => navigate('/login')}
            className="auth-btn"
          >
            <span>{T.login}</span>
          </button>

          <button
            onClick={() => navigate('/register')}
            className="auth-btn register-btn"
          >
            <span>{T.register}</span>
          </button>

        </div>

      ) : (

        <div className="sidebar-footer">

          <div className="sidebar-profile">

            <div className="profile-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="profile-info">

              <div className="profile-name">
                {userName}
              </div>

              <div className="profile-plan">
                {T.patient}
              </div>

            </div>

          </div>

        </div>

      )}

    </aside>
  );
};

export default PublicSidebar;