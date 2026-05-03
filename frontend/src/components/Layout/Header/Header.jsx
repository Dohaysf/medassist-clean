import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="app-header">
      <div className="header-title">
        <h1>Assistant Médical Pré-Hospitalier</h1>
      </div>
      <div className="header-user">
        <span>👤</span>
      </div>
    </header>
  );
};

export default Header;