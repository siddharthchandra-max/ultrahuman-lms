import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatINR, formatDate } from '../utils/api';

export default function Shipments() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filterOpts, setFilterOpts] = useState({ products: [], countries: [], months: [], statuses: [] });
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/shipments/filters').then(r => setFilterOpts(r.data)).catch(() => {}); }, []);

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 50, sortBy: 'shipmentDate', sortOrder: -1 };
      if (search) params.search = search;
      if (activeTab) params.product = activeTab;
      if (filters.month) params.month = filters.month;
      if (filters.destCode) params.destCode = filters.destCode;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/shipments', { params });
      setShipments(data.shipments);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, activeTab, filters]);

  useEffect(() => { fetch(1); }, [fetch]);

  const statusBadge = (s) => {
    const map = { Delivered: 'badge-green', 'In Transit': 'badge-blue', Failed: 'badge-red', Booked: 'badge-orange', Returned: 'badge-purple' };
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s || 'Unknown'}</span>;
  };

  const productBadge = (p) => {
    if (p === 'DUTIES & TAXES') return <span className="badge badge-red">D&T</span>;
    return <span className="badge badge-blue">FREIGHT</span>;
  };

  return (
    <div>
      <div className="filter-bar">
        <input className="search-input" placeholder="Search AWB / Invoice..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filters.month || ''} onChange={e => setFilters(f => ({ ...f, month: e.target.value || undefined }))}>
          <option value="">All Months</option>
          {filterOpts.months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="filter-select" value={filters.destCode || ''} onChange={e => setFilters(f => ({ ...f, destCode: e.target.value || undefined }))}>
          <option value="">All Countries</option>
          {filterOpts.countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select className="filter-select" value={filters.status || ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
          <option value="">All Status</option>
          {filterOpts.statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="date-badge">Dec 2025 &mdash; Feb 2026</div>
      </div>

      <div className="tabs">
        <div className={`tab${activeTab === '' ? ' active' : ''}`} onClick={() => setActiveTab('')}>All <span className="tab-count">{pagination.total.toLocaleString()}</span></div>
        {filterOpts.products.slice(0, 6).map(p => (
          <div key={p} className={`tab${activeTab === p ? ' active' : ''}`} onClick={() => setActiveTab(p)}>
            {p.replace('EXPRESS ', '')} <span className="tab-count"></span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>AWB No.</th><th>Courier</th><th>Date</th><th>Week</th><th>Destination</th>
                <th>Weight</th><th>Amount</th><th>Product</th><th>Month</th><th>Type</th><th>Status</th><th>Track</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>Loading...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>No shipments found</td></tr>
              ) : shipments.map((s, i) => (
                <tr key={s._id || i}>
                  <td style={{ fontWeight: 500 }}>{s.awb}</td>
                  <td><span style={{ fontWeight: 700, color: '#c00', fontSize: 12, letterSpacing: 1 }}>{s.courier || 'DHL'}</span></td>
                  <td>{formatDate(s.shipmentDate)}</td>
                  <td>{s.week || '-'}</td>
                  <td>{s.destName || s.destCode || '-'}</td>
                  <td>{s.weight ? `${s.weight.toFixed(1)} kg` : '-'}</td>
                  <td>{formatINR(s.totalInclVAT)}</td>
                  <td style={{ fontSize: 12 }}>{s.productName || '-'}</td>
                  <td>{s.month}</td>
                  <td>{productBadge(s.productName)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td><button className="btn btn-sm btn-primary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => navigate(`/tracking?awb=${s.awb}`)}>Track</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pagination">
        <span>Showing {((pagination.page - 1) * 50) + 1}–{Math.min(pagination.page * 50, pagination.total)} of {pagination.total.toLocaleString()}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetch(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
          <span style={{ padding: '6px 12px', fontSize: 13 }}>Page {pagination.page} / {pagination.pages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => fetch(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next</button>
        </div>
      </div>
    </div>
  );
}
