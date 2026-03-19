import React, { useState } from 'react';
import api from '../utils/api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left — Dark Hero */}
      <div className="login-hero">
        {/* Ultrahuman Logo */}
        <div className="login-hero-brand">
          <svg className="uh-logo" viewBox="0 0 120 28" fill="none">
            <path d="M14 0L0 14l14 14L28 14 14 0z" fill="#fff"/>
            <path d="M14 6l-8 8 8 8 8-8-8-8z" fill="#000"/>
            <text x="34" y="20" fill="#fff" fontSize="16" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="-0.5">ULTRAHUMAN</text>
          </svg>
        </div>

        {/* Central visual */}
        <div className="login-hero-center">
          <div className="hero-ring-glow" />
          <div className="hero-glass-card">
            <div className="glass-metric">
              <div className="glass-metric-icon blue">
                <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <div>
                <div className="glass-metric-value">12,847</div>
                <div className="glass-metric-label">Shipments Tracked</div>
              </div>
            </div>
            <div className="glass-divider" />
            <div className="glass-metric">
              <div className="glass-metric-icon green">
                <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <div className="glass-metric-value">98.2%</div>
                <div className="glass-metric-label">Delivery Rate</div>
              </div>
            </div>
            <div className="glass-divider" />
            <div className="glass-metric">
              <div className="glass-metric-icon orange">
                <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div>
                <div className="glass-metric-value">121</div>
                <div className="glass-metric-label">Countries</div>
              </div>
            </div>
          </div>

          <div className="hero-tagline">
            <span className="hero-tag">Logistics Management System</span>
            <h2>Track. Reconcile.<br/><span>Optimize.</span></h2>
            <p>Real-time shipment tracking & financial reconciliation for global logistics operations.</p>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="login-form-side">
        <div className="login-form-container">
          <div className="login-form-logo">
            <svg viewBox="0 0 120 28" fill="none" style={{ height: 22 }}>
              <path d="M14 0L0 14l14 14L28 14 14 0z" fill="#000"/>
              <path d="M14 6l-8 8 8 8 8-8-8-8z" fill="#fff"/>
              <text x="34" y="20" fill="#000" fontSize="16" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="-0.5">ULTRAHUMAN</text>
            </svg>
          </div>

          <h1>Welcome back</h1>
          <p className="login-form-desc">Sign in to your UH-LMS account</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@ultrahuman.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="login-footer-text">
            Powered by <strong>Ultrahuman</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
