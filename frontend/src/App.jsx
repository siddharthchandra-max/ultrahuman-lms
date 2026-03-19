import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Shipments from './pages/Shipments';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Upload from './pages/Upload';
import Tracking from './pages/Tracking';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('uh_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('uh_user')); } catch { return null; }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOverlay, setSidebarOverlay] = useState(false);

  const handleLogin = (t, u) => {
    setToken(t);
    setUser(u);
    localStorage.setItem('uh_token', t);
    localStorage.setItem('uh_user', JSON.stringify(u));
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('uh_token');
    localStorage.removeItem('uh_user');
    navigate('/login');
  };

  if (!token && location.pathname !== '/login') return <Navigate to="/login" />;
  if (location.pathname === '/login') return <Login onLogin={handleLogin} />;

  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/shipments': 'Shipments',
    '/tracking': 'Shipment Tracking',
    '/invoices': 'Invoices',
    '/reports': 'Reports & Analytics',
    '/upload': 'Upload Data',
  };

  const isTracking = location.pathname === '/tracking';

  return (
    <>
      {!isTracking && <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      {isTracking && sidebarOverlay && (
        <>
          <div className="sidebar-overlay-backdrop" onClick={() => setSidebarOverlay(false)} />
          <Sidebar collapsed={false} onToggle={() => setSidebarOverlay(false)} />
        </>
      )}
      <div className={`main-wrapper${isTracking ? ' no-sidebar' : ''}`}>
        <Header title={pageTitles[location.pathname] || 'Dashboard'} user={user} onLogout={handleLogout} showMenu={isTracking} onMenuClick={() => setSidebarOverlay(!sidebarOverlay)} />
        <div className="main">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </div>
    </>
  );
}
