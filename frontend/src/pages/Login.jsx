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
      {/* Left — Hero */}
      <div className="login-hero">
        <div className="login-hero-brand">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <span>UH-LMS</span>
        </div>

        <div className="login-hero-content">
          {/* Floating feature cards */}
          <div className="hero-feature" style={{ top: '18%', left: '22%' }}>
            <div className="hero-feature-icon">
              <svg viewBox="0 0 24 24"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <span>Shipments</span>
          </div>

          <div className="hero-feature" style={{ top: '35%', left: '50%' }}>
            <div className="hero-feature-icon orange">
              <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <span>Real Time Tracking</span>
          </div>

          <div className="hero-feature" style={{ top: '55%', left: '18%' }}>
            <div className="hero-feature-icon green">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <span>Invoice Reconciliation</span>
          </div>

          <div className="hero-feature" style={{ top: '48%', left: '55%' }}>
            <div className="hero-feature-icon purple">
              <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <span>Analytics</span>
          </div>

          <div className="hero-feature" style={{ top: '72%', left: '40%' }}>
            <div className="hero-feature-icon">
              <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span style={{ color: '#0efc6d' }}>Delivered</span>
          </div>

          {/* Connecting dots */}
          <div className="hero-dot" style={{ top: '30%', left: '42%' }} />
          <div className="hero-dot" style={{ top: '50%', left: '38%' }} />
          <div className="hero-dot small" style={{ top: '65%', left: '55%' }} />
        </div>
      </div>

      {/* Right — Form */}
      <div className="login-form-side">
        <div className="login-form-container">
          <h1>Welcome to <span className="text-accent">UH-LMS</span></h1>
          <div className="login-subtitle">Logistics Management & Intelligence Platform</div>

          <div className="login-section-title">Sign in to your account</div>
          <p className="login-section-desc">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
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
