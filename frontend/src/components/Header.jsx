import React, { useState, useRef, useEffect } from 'react';

const THEMES = [
  { key: 'bright', label: 'Bright', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )},
  { key: 'night', label: 'Night', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  )},
  { key: 'eye-care', label: 'Eye Care', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )},
];

export default function Header({ title, user, onLogout, onMenuClick, showMenu, theme, onThemeChange }) {
  const [showThemes, setShowThemes] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const themeRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (themeRef.current && !themeRef.current.contains(e.target)) setShowThemes(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentTheme = THEMES.find(t => t.key === theme) || THEMES[0];

  return (
    <div className="header">
      <div className="header-left">
        {showMenu && (
          <div className="header-menu-btn" onClick={onMenuClick} title="Open sidebar">
            <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </div>
        )}
        <h1>{title}</h1>
      </div>
      <div className="header-right">
        <div className="theme-toggle" ref={themeRef}>
          <div className="header-icon-btn" onClick={() => setShowThemes(!showThemes)} title="Theme">
            {currentTheme.icon}
          </div>
          {showThemes && (
            <div className="theme-dropdown">
              {THEMES.map(t => (
                <div
                  key={t.key}
                  className={`theme-option ${theme === t.key ? 'active' : ''}`}
                  onMouseDown={() => { onThemeChange(t.key); setShowThemes(false); }}
                >
                  <span className="theme-option-icon">{t.icon}</span>
                  <span>{t.label}</span>
                  {theme === t.key && (
                    <svg className="theme-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="header-icon-btn" title="Notifications">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          <div className="notification-dot"></div>
        </div>
        <div className="header-icon-btn" title="Settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </div>
        <div className="header-divider"></div>
        <div className="user-menu" ref={userMenuRef} onClick={() => setShowUserMenu(!showUserMenu)} style={{ position: 'relative', cursor: 'pointer' }}>
          <div className="user-avatar">
            {(user?.name || 'A')[0].toUpperCase()}
          </div>
          <div className="user-info">
            <div className="name">{user?.name || 'Admin'}</div>
            <div className="role">{user?.role || 'Administrator'}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, opacity: 0.5 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {showUserMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180,
              zIndex: 1000, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary, #111)' }}>{user?.name || 'Admin'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #6b7280)', marginTop: 2 }}>{user?.email || ''}</div>
              </div>
              <div
                onMouseDown={() => { setShowUserMenu(false); onLogout(); }}
                style={{
                  padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontSize: 13, color: '#ef4444', fontWeight: 500,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #f9fafb)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
