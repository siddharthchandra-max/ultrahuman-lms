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
      {/* Background layer */}
      <div className="login-bg">
        {/* Subtle grid */}
        <div className="login-grid" />

        {/* Gradient orbs */}
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />

        {/* Animated route paths with moving shipment dots */}
        <svg className="login-routes" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {/* Route paths */}
          <path className="login-route lr-1" d="M-50,600 C200,500 400,200 600,300 S900,100 1250,200" />
          <path className="login-route lr-2" d="M-50,400 C150,300 350,500 550,350 S800,200 1250,350" />
          <path className="login-route lr-3" d="M-50,200 C200,350 500,100 700,250 S1000,400 1250,300" />

          {/* Node points along routes */}
          <circle cx="200" cy="470" r="3" className="login-node ln-1" />
          <circle cx="600" cy="300" r="4" className="login-node ln-2" />
          <circle cx="900" cy="150" r="3" className="login-node ln-3" />
          <circle cx="350" cy="420" r="3" className="login-node ln-4" />
          <circle cx="700" cy="260" r="3" className="login-node ln-5" />

          {/* Pulsing rings at key nodes */}
          <circle cx="600" cy="300" r="4" className="login-pulse lp-1" />
          <circle cx="200" cy="470" r="4" className="login-pulse lp-2" />
          <circle cx="900" cy="150" r="4" className="login-pulse lp-3" />

          {/* Moving dots along routes */}
          <circle r="3" className="login-dot ld-1">
            <animateMotion dur="8s" repeatCount="indefinite" path="M-50,600 C200,500 400,200 600,300 S900,100 1250,200" />
          </circle>
          <circle r="2.5" className="login-dot ld-2">
            <animateMotion dur="10s" repeatCount="indefinite" path="M-50,400 C150,300 350,500 550,350 S800,200 1250,350" />
          </circle>
          <circle r="2" className="login-dot ld-3">
            <animateMotion dur="12s" repeatCount="indefinite" path="M-50,200 C200,350 500,100 700,250 S1000,400 1250,300" />
          </circle>
        </svg>

        {/* Floating particles */}
        <div className="login-particles">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="login-particle"
              style={{
                left: `${8 + (i * 7.5) % 85}%`,
                top: `${10 + (i * 13) % 75}%`,
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${8 + (i % 4) * 2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Login card */}
      <div className="login-card">
        {/* Branding header */}
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="login-brand-text">
            <span className="login-brand-name">UH-LMS</span>
            <span className="login-brand-tag">Logistics Management</span>
          </div>
        </div>

        <div className="login-card-divider" />

        {/* Title */}
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to your account to continue</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? (
              <span className="login-spinner" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          Powered by <strong>Ultrahuman</strong>
        </div>
      </div>
    </div>
  );
}
