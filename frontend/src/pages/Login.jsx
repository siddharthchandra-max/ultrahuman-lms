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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f0f2f5',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 420,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: 0, letterSpacing: -0.5 }}>
          UH-LMS
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '8px 0 32px' }}>
          Ultrahuman Logistics Management System
        </p>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {error && (
            <div style={{
              padding: '12px 16px', background: '#fff5f5', color: '#e53e3e',
              border: '1px solid #fed7d7', borderRadius: 10, marginBottom: 20, fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@ultrahuman.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', border: '1.5px solid #e5e5e5',
                borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#000',
                background: '#fff', boxSizing: 'border-box', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#000'}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', border: '1.5px solid #e5e5e5',
                borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#000',
                background: '#fff', boxSizing: 'border-box', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#000'}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', background: '#1a1a2e', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1, marginTop: 8,
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#bbb', marginTop: 32, marginBottom: 0 }}>
          Powered by <strong style={{ color: '#999' }}>Ultrahuman</strong>
        </p>
      </div>
    </div>
  );
}
