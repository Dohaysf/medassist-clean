import React from 'react';
import PublicSidebar from './PublicSidebar';
import './PublicLayout.css';

const PublicLayout = ({ children }) => {
  return (
    <div className="public-layout">
      <PublicSidebar />
      <div className="public-content">
        <div className="public-page-container">{children}</div>
      </div>
    </div>
  );
};

export default PublicLayout;