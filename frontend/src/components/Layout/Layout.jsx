import React, { useEffect } from 'react';
import Sidebar from './Sidebar/Sidebar';
import './Layout.css';

const Layout = ({ children }) => {
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
  }, []);

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-content">
        <div className="admin-page-container">{children}</div>
      </div>
    </div>
  );
};

export default Layout;