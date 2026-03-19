import React, { useState, useEffect, useCallback } from 'react';
import api, { formatINR, formatDate } from '../utils/api';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Booked', label: 'Booked' },
  { key: 'In Transit', label: 'Active' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Failed', label: 'Failed' },
  { key: 'Unknown', label: 'No Info Yet' },
];

export default function Tracking() {
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filterOpts, setFilterOpts] = useState({ products: [], countries: [], months: [], statuses: [] });
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState({});
  const [viewMode, setViewMode] = useState('AWB');

  useEffect(() => {
    api.get('/shipments/filters').then(r => setFilterOpts(r.data)).catch(() => {});
    // Get status counts
    api.get('/tracking/summary/stats').then(r => {
      const counts = {};
      (r.data.byMilestone || []).forEach(m => { counts[m._id] = m.count; });
      setStatusCounts(counts);
    }).catch(() => {});
  }, []);

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 50, sortBy: 'shipmentDate', sortOrder: -1 };
      if (search) params.search = search;
      if (activeTab) params.status = activeTab;
      if (filters.month) params.month = filters.month;
      if (filters.destCode) params.destCode = filters.destCode;
      if (filters.product) params.product = filters.product;
      const { data } = await api.get('/shipments', { params });
      setShipments(data.shipments);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, activeTab, filters]);

  useEffect(() => { fetch(1); }, [fetch]);

  const getTotal = () => {
    return Object.values(statusCounts).reduce((a, b) => a + b, 0) || pagination.total;
  };

  const getTabCount = (key) => {
    if (!key) return getTotal();
    if (key === 'In Transit') {
      return (statusCounts['In Transit'] || 0) + (statusCounts['Picked Up'] || 0) + (statusCounts['Customs'] || 0) + (statusCounts['Out for Delivery'] || 0);
    }
    return statusCounts[key] || 0;
  };

  const statusBadge = (s) => {
    const map = {
      'Delivered': { bg: '#d1fae5', color: '#065f46', label: 'DELIVERED' },
      'In Transit': { bg: '#dbeafe', color: '#1e40af', label: 'IN TRANSIT' },
      'Booked': { bg: '#fef3c7', color: '#92400e', label: 'BOOKED' },
      'Picked Up': { bg: '#e0e7ff', color: '#3730a3', label: 'PICKED UP' },
      'Customs': { bg: '#ede9fe', color: '#5b21b6', label: 'CUSTOMS' },
      'Out for Delivery': { bg: '#cffafe', color: '#155e75', label: 'OUT FOR DELIVERY' },
      'Failed': { bg: '#fee2e2', color: '#991b1b', label: 'FAILED' },
      'Returned': { bg: '#fce7f3', color: '#9d174d', label: 'RETURNED' },
      'Unknown': { bg: '#f3f4f6', color: '#6b7280', label: 'PENDING' },
    };
    const m = map[s] || map['Unknown'];
    return <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</span>;
  };

  const tatBadge = () => (
    <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#fff3cd', color: '#856404' }}>PENDING</span>
  );

  const naBadge = () => (
    <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>NA</span>
  );

  const daysSince = (date) => {
    if (!date) return '-';
    const d = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return d >= 0 ? d : '-';
  };

  const timeSince = (date) => {
    if (!date) return '-';
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 60) return `${mins}mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}hrs ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div>
      {/* Top bar */}
      <div className="tracking-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="tracking-toggle">
            {['AWB', 'Invoice', 'UHR'].map(mode => (
              <span key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode)}>{mode}</span>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              className="tracking-search"
              placeholder={`Search ${viewMode} No.`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetch(1)}
            />
            <svg className="tracking-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div className="date-badge">01-Dec-2025 - 28-Feb-2026</div>
        </div>
      </div>

      {/* Filters */}
      <div className="tracking-filters">
        <select className="filter-select" value={filters.product || ''} onChange={e => setFilters(f => ({ ...f, product: e.target.value || undefined }))}>
          <option value="">Courier Name</option>
          <option>DHL</option>
        </select>
        <select className="filter-select" value={filters.month || ''} onChange={e => setFilters(f => ({ ...f, month: e.target.value || undefined }))}>
          <option value="">Month</option>
          {filterOpts.months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="filter-select" value={filters.destCode || ''} onChange={e => setFilters(f => ({ ...f, destCode: e.target.value || undefined }))}>
          <option value="">Destination Country</option>
          {filterOpts.countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select className="filter-select">
          <option value="">Shipment Type</option>
          <option>EXPRESS WORLDWIDE</option>
          <option>DUTIES & TAXES</option>
        </select>
      </div>

      {/* Status Tabs */}
      <div className="tracking-tabs">
        {STATUS_TABS.map(t => (
          <div
            key={t.key}
            className={`tracking-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label} <span className="tracking-tab-count">{getTabCount(t.key).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table className="tracking-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" /></th>
                <th>AWB No.</th>
                <th>Courier</th>
                <th>Booked Date</th>
                <th>Dispatch Date</th>
                <th>Week</th>
                <th>Destination</th>
                <th>Delay Days</th>
                <th>Transit Days</th>
                <th>Weight</th>
                <th>Amount</th>
                <th>Product</th>
                <th>Month</th>
                <th>Last Synced</th>
                <th>Shipment Status</th>
                <th>TAT Status</th>
                <th>POD Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={18} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={18} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>No shipments found</td></tr>
              ) : shipments.map((s, i) => (
                <tr key={s._id || i}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 12 }}>{s.awb}</td>
                  <td><span style={{ fontWeight: 700, color: '#c00', fontSize: 11, letterSpacing: 0.5 }}>{s.courier || 'DHL'}</span></td>
                  <td>{formatDate(s.shipmentDate)}</td>
                  <td>{s.trackingStatus?.lastEventTime ? formatDate(s.trackingStatus.lastEventTime) : '-'}</td>
                  <td>{s.week || '-'}</td>
                  <td>{s.destName || s.destCode || '-'}</td>
                  <td style={{ color: 'var(--gray-400)' }}>-</td>
                  <td>{daysSince(s.shipmentDate)}</td>
                  <td>{s.weight ? `${s.weight.toFixed(1)}` : '-'}</td>
                  <td>{s.totalInclVAT ? formatINR(s.totalInclVAT) : '-'}</td>
                  <td style={{ fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.productName || '-'}</td>
                  <td>{s.month}</td>
                  <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{timeSince(s.updatedAt)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td>{tatBadge()}</td>
                  <td>{naBadge()}</td>
                  <td>
                    <span style={{ color: '#0882ff', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Update Status</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="pagination" style={{ padding: '8px 16px' }}>
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
