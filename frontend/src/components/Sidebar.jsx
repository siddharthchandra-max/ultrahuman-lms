import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  {
    section: 'Main',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: (
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      )},
      { path: '/tracking', label: 'Tracking', icon: (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
      )},
    ]
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M10.5 1L1 10.5h6v6h4V10.5h6z" fill="#fff"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="brand-text">
            <h2>UH-LMS</h2>
            <span>Logistics Management</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems.map(section => (
          <div key={section.section}>
            {!collapsed && <div className="nav-section-label">{section.section}</div>}
            {section.items.map(item => (
              <div
                key={item.path}
                className={`nav-item${loc.pathname === item.path ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-toggle" onClick={onToggle}>
        {collapsed ? (
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        ) : (
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        )}
      </div>
    </div>
  );
}
