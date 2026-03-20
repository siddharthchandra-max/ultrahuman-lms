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
        <div className="login-hero-brand" />

        {/* Animated background elements */}
        <div className="hero-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              opacity: 0.15 + Math.random() * 0.35,
            }} />
          ))}
        </div>

        {/* Animated route lines */}
        <svg className="hero-routes" viewBox="0 0 500 500" preserveAspectRatio="none">
          <path className="route-path r1" d="M50,400 Q150,200 250,250 T450,100" />
          <path className="route-path r2" d="M0,300 Q200,100 300,200 T500,50" />
          <path className="route-path r3" d="M100,450 Q250,300 350,350 T500,200" />
          <circle className="route-dot d1" r="4"><animateMotion dur="4s" repeatCount="indefinite" path="M50,400 Q150,200 250,250 T450,100" /></circle>
          <circle className="route-dot d2" r="3"><animateMotion dur="5s" repeatCount="indefinite" path="M0,300 Q200,100 300,200 T500,50" /></circle>
          <circle className="route-dot d3" r="3.5"><animateMotion dur="6s" repeatCount="indefinite" path="M100,450 Q250,300 350,350 T500,200" /></circle>
        </svg>

        {/* Orbiting rings */}
        <div className="hero-orbit orbit-1"><div className="orbit-dot" /></div>
        <div className="hero-orbit orbit-2"><div className="orbit-dot" /></div>

        {/* World map supply chain network */}
        <svg className="hero-world-map" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
          {/* Simplified world map dots */}
          {/* North America */}
          <circle cx="130" cy="140" r="3" className="map-node" /><text x="130" y="128" className="map-label">NYC</text>
          <circle cx="90" cy="160" r="2.5" className="map-node" /><text x="90" y="148" className="map-label">LA</text>
          {/* Europe */}
          <circle cx="310" cy="120" r="3" className="map-node" /><text x="310" y="108" className="map-label">LON</text>
          <circle cx="340" cy="135" r="2.5" className="map-node" /><text x="340" y="123" className="map-label">FRA</text>
          {/* Asia */}
          <circle cx="460" cy="150" r="3" className="map-node" /><text x="460" y="138" className="map-label">MUM</text>
          <circle cx="510" cy="160" r="3" className="map-node" /><text x="510" y="148" className="map-label">BLR</text>
          <circle cx="490" cy="130" r="2.5" className="map-node" /><text x="490" y="118" className="map-label">DEL</text>
          <circle cx="530" cy="175" r="2.5" className="map-node" /><text x="530" y="163" className="map-label">SIN</text>
          {/* Middle East */}
          <circle cx="390" cy="170" r="2.5" className="map-node" /><text x="390" y="158" className="map-label">DXB</text>
          {/* Australia */}
          <circle cx="530" cy="300" r="2.5" className="map-node" /><text x="530" y="288" className="map-label">SYD</text>

          {/* Animated supply chain connections */}
          <line className="supply-line sl1" x1="460" y1="150" x2="310" y2="120" />
          <line className="supply-line sl2" x1="460" y1="150" x2="390" y2="170" />
          <line className="supply-line sl3" x1="310" y1="120" x2="130" y2="140" />
          <line className="supply-line sl4" x1="510" y1="160" x2="530" y2="175" />
          <line className="supply-line sl5" x1="390" y1="170" x2="310" y2="120" />
          <line className="supply-line sl6" x1="530" y1="175" x2="530" y2="300" />
          <line className="supply-line sl7" x1="460" y1="150" x2="490" y2="130" />
          <line className="supply-line sl8" x1="490" y1="130" x2="510" y2="160" />

          {/* Moving shipment dots along routes */}
          <circle r="3" className="shipment-dot sd-blue"><animateMotion dur="3s" repeatCount="indefinite" path="M460,150 L310,120" /></circle>
          <circle r="3" className="shipment-dot sd-green"><animateMotion dur="4s" repeatCount="indefinite" path="M310,120 L130,140" /></circle>
          <circle r="2.5" className="shipment-dot sd-yellow"><animateMotion dur="3.5s" repeatCount="indefinite" path="M460,150 L390,170" /></circle>
          <circle r="2.5" className="shipment-dot sd-blue"><animateMotion dur="5s" repeatCount="indefinite" path="M530,175 L530,300" /></circle>
          <circle r="2.5" className="shipment-dot sd-green"><animateMotion dur="4.5s" repeatCount="indefinite" path="M390,170 L310,120" /></circle>

          {/* Pulsing hub rings */}
          <circle cx="460" cy="150" r="8" className="hub-pulse" />
          <circle cx="310" cy="120" r="6" className="hub-pulse hp2" />
          <circle cx="130" cy="140" r="6" className="hub-pulse hp3" />
        </svg>

        {/* Floating logistics icons */}
        <div className="hero-float-icons">
          {/* Airplane */}
          <div className="float-icon fi-plane">
            <svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          </div>
          {/* Ship */}
          <div className="float-icon fi-ship">
            <svg viewBox="0 0 24 24"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0020 17l-2-3H6l-2 3c0 1 .19 2 .62 3"/><path d="M9 12V6h6v6"/><path d="M12 6V2"/></svg>
          </div>
          {/* Package/Box */}
          <div className="float-icon fi-box">
            <svg viewBox="0 0 24 24"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          {/* Warehouse */}
          <div className="float-icon fi-warehouse">
            <svg viewBox="0 0 24 24"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21V13h6v8"/><path d="M3 8h18"/></svg>
          </div>
          {/* Barcode/Scanner */}
          <div className="float-icon fi-barcode">
            <svg viewBox="0 0 24 24"><rect x="2" y="4" width="2" height="16"/><rect x="6" y="4" width="1" height="16"/><rect x="9" y="4" width="2" height="16"/><rect x="13" y="4" width="1" height="16"/><rect x="16" y="4" width="2" height="16"/><rect x="20" y="4" width="2" height="16"/></svg>
          </div>
          {/* GPS/Location */}
          <div className="float-icon fi-gps">
            <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>

        {/* Animated truck */}
        <div className="hero-truck">
          <svg viewBox="0 0 60 24" className="truck-svg">
            <rect x="0" y="4" width="35" height="16" rx="2" fill="rgba(0,127,245,0.15)" stroke="#007ff5" strokeWidth="0.8"/>
            <rect x="35" y="8" width="18" height="12" rx="1" fill="rgba(0,127,245,0.1)" stroke="#007ff5" strokeWidth="0.8"/>
            <polygon points="53,12 58,12 58,18 53,20" fill="rgba(0,127,245,0.1)" stroke="#007ff5" strokeWidth="0.8"/>
            <circle cx="12" cy="22" r="3" fill="#007ff5" opacity="0.6"/>
            <circle cx="28" cy="22" r="3" fill="#007ff5" opacity="0.6"/>
            <circle cx="48" cy="22" r="3" fill="#007ff5" opacity="0.6"/>
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

          {/* Live tracking feed */}
          <div className="hero-live-feed">
            <div className="live-feed-item lfi-1">
              <div className="lfi-dot delivered" />
              <div className="lfi-text">
                <span className="lfi-awb">AWB 2847391056</span>
                <span className="lfi-status">Delivered to Mumbai</span>
              </div>
              <span className="lfi-time">2m ago</span>
            </div>
            <div className="live-feed-item lfi-2">
              <div className="lfi-dot transit" />
              <div className="lfi-text">
                <span className="lfi-awb">AWB 9173625480</span>
                <span className="lfi-status">In Transit — Frankfurt Hub</span>
              </div>
              <span className="lfi-time">5m ago</span>
            </div>
            <div className="live-feed-item lfi-3">
              <div className="lfi-dot customs" />
              <div className="lfi-text">
                <span className="lfi-awb">AWB 6042817395</span>
                <span className="lfi-status">Customs Clearance — Singapore</span>
              </div>
              <span className="lfi-time">8m ago</span>
            </div>
          </div>

          {/* Finance reconciliation ticker */}
          <div className="hero-finance-ticker">
            <div className="ticker-track">
              <div className="ticker-item"><span className="tk-label">Invoices Matched</span><span className="tk-value tk-green">4,291</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Pending Reco</span><span className="tk-value tk-yellow">156</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Overcharged</span><span className="tk-value tk-red">23</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Savings Found</span><span className="tk-value tk-green">$12.4K</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Invoices Matched</span><span className="tk-value tk-green">4,291</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Pending Reco</span><span className="tk-value tk-yellow">156</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Overcharged</span><span className="tk-value tk-red">23</span></div>
              <div className="ticker-sep" />
              <div className="ticker-item"><span className="tk-label">Savings Found</span><span className="tk-value tk-green">$12.4K</span></div>
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
