import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  {
    section: 'Main',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: (
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      )},
      { path: '/shipments', label: 'Shipments', icon: (
        <svg viewBox="0 0 24 24"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      )},
      { path: '/tracking', label: 'Tracking', icon: (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
      )},
      { path: '/invoices', label: 'Invoices', icon: (
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      )},
    ]
  },
  {
    section: 'Analytics',
    items: [
      { path: '/reports', label: 'Reports', icon: (
        <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      )},
    ]
  },
  {
    section: 'Data',
    items: [
      { path: '/upload', label: 'Upload Data', icon: (
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      )},
    ]
  }
];

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="brand-text">
            <h2>UH-LMS</h2>
            <span>Logistics System</span>
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
