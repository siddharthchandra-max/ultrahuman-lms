import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import api, { formatINR } from '../utils/api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const COLORS = ['#6c5ce7','#00b894','#fdcb6e','#e17055','#00cec9','#a29bfe','#fab1a0','#74b9ff','#55efc4','#ff7675'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/dashboard/summary', { params: filters })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading && !data) return (
    <div style={{ padding: 80, textAlign: 'center', color: 'var(--gray-400)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      </div>
      <p style={{ fontWeight: 500 }}>Loading dashboard...</p>
    </div>
  );
  if (!data || !data.totals) return (
    <div style={{ padding: 80, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--gray-300)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      </div>
      <h3 style={{ color: 'var(--gray-600)', marginBottom: 8, fontSize: 16 }}>No Data Yet</h3>
      <p style={{ color: 'var(--gray-400)', fontSize: 13, maxWidth: 360, margin: '0 auto' }}>
        Upload your DHL billing files from the <strong>Upload Data</strong> page to see your dashboard metrics and analytics.
      </p>
    </div>
  );

  const { totals, byProduct, byCountry, byMonth, byStatus } = data;
  const duties = byProduct.find(p => p._id === 'DUTIES & TAXES')?.count || 0;
  const freight = totals.total - duties;
  const freightProducts = byProduct.filter(p => p._id && p._id !== 'DUTIES & TAXES' && p._id !== 'Unknown');

  return (
    <div>
      {/* Filters */}
      <div className="filter-bar">
        <select className="filter-select" value={filters.product || ''} onChange={e => setFilters(f => ({ ...f, product: e.target.value || undefined }))}>
          <option value="">All Products</option>
          {byProduct.map(p => <option key={p._id} value={p._id}>{p._id}</option>)}
        </select>
        <select className="filter-select" value={filters.month || ''} onChange={e => setFilters(f => ({ ...f, month: e.target.value || undefined }))}>
          <option value="">All Months</option>
          {byMonth.map(m => <option key={m._id} value={m._id}>{m._id}</option>)}
        </select>
        <select className="filter-select" value={filters.destCode || ''} onChange={e => setFilters(f => ({ ...f, destCode: e.target.value || undefined }))}>
          <option value="">All Countries</option>
          {byCountry.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <div className="date-badge">Dec 2025 &mdash; Feb 2026</div>
      </div>

      {/* KPI Metrics */}
      <div className="metric-grid cols-5">
        <div className="metric-card blue">
          <div className="metric-label">Total Shipments</div>
          <div className="metric-value">{totals.total.toLocaleString()}</div>
          <div className="metric-sub">Across all months</div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Freight Shipments</div>
          <div className="metric-value">{freight.toLocaleString()}</div>
          <div className="metric-sub"><span className="up">{Math.round(freight/totals.total*100)}%</span> of total</div>
        </div>
        <div className="metric-card red">
          <div className="metric-label">Duties & Taxes</div>
          <div className="metric-value">{duties.toLocaleString()}</div>
          <div className="metric-sub"><span className="down">{Math.round(duties/totals.total*100)}%</span> of total</div>
        </div>
        <div className="metric-card orange">
          <div className="metric-label">Total Cost (Incl. VAT)</div>
          <div className="metric-value" style={{ fontSize: 22 }}>{formatINR(totals.totalInclVAT)}</div>
          <div className="metric-sub">INR</div>
        </div>
        <div className="metric-card purple">
          <div className="metric-label">Countries Served</div>
          <div className="metric-value">{byCountry.length}</div>
          <div className="metric-sub">Destinations</div>
        </div>
      </div>

      {/* Product Strip */}
      <div className="status-strip">
        {freightProducts.slice(0, 5).map(p => (
          <div className="status-strip-item" key={p._id}>
            <div className="label">{p._id}</div>
            <div className="value">{p.count.toLocaleString()} <span className="badge badge-purple" style={{ fontSize: 10, marginLeft: 6 }}>{Math.round(p.count/totals.total*100)}%</span></div>
          </div>
        ))}
      </div>

      {/* Monthly Strip */}
      <div className="status-strip">
        {byMonth.map(m => (
          <div className="status-strip-item" key={m._id}>
            <div className="label">{m._id}</div>
            <div className="value">{m.count.toLocaleString()} <span className="badge badge-green" style={{ fontSize: 10, marginLeft: 6 }}>{formatINR(m.amount)}</span></div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Top Destination Countries</h3></div>
          <div className="card-body">
            <Bar data={{
              labels: byCountry.slice(0, 12).map(c => (c.name || c.code || '').slice(0, 18)),
              datasets: [{ label: 'Shipments', data: byCountry.slice(0, 12).map(c => c.count), backgroundColor: COLORS, borderRadius: 6 }]
            }} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } }} height={300} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Product Distribution</h3></div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 280, height: 280 }}>
              <Doughnut data={{
                labels: freightProducts.map(p => p._id),
                datasets: [{ data: freightProducts.map(p => p.count), backgroundColor: COLORS, borderWidth: 0, spacing: 2 }]
              }} options={{ cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, family: 'Inter' }, padding: 12 } } } }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Monthly Shipment Volume</h3></div>
          <div className="card-body">
            <Bar data={{
              labels: byMonth.map(m => m._id),
              datasets: [{ label: 'Shipments', data: byMonth.map(m => m.count), backgroundColor: COLORS, borderRadius: 8 }]
            }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } } }} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Cost by Country (Top 10)</h3></div>
          <div className="card-body">
            <Bar data={{
              labels: byCountry.slice(0, 10).map(c => c.code),
              datasets: [{ label: 'Incl. VAT', data: byCountry.slice(0, 10).map(c => Math.round(c.amount)), backgroundColor: COLORS }]
            }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
