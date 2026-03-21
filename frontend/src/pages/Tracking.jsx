import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatINR, formatDate } from '../utils/api';
import DateRangePicker from '../components/DateRangePicker';
import BulkManagement from '../components/BulkManagement';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Booked', label: 'Booked' },
  { key: 'In Transit', label: 'Active' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Failed', label: 'Failed' },
  { key: 'Unknown', label: 'No Info Yet' },
];

export default function Tracking() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filterOpts, setFilterOpts] = useState({ products: [], countries: [], months: [], statuses: [] });
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState({});
  const [viewMode, setViewMode] = useState('AWB');
  const [dateFrom, setDateFrom] = useState('2025-12-01');
  const [dateTo, setDateTo] = useState('2026-02-28');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

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
      if (filters.warehouse) params.warehouse = filters.warehouse;
      if (filters.destCode) params.destCode = filters.destCode;
      if (filters.product) params.product = filters.product;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await api.get('/shipments', { params });
      setShipments(data.shipments);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, activeTab, filters, dateFrom, dateTo]);

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
    <div className="tracking-page">
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
          <div className="date-badge" onClick={() => setShowDatePicker(true)} style={{ cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - {new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          {showDatePicker && (
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </div>
        <button className="btn-bulk-mgmt" onClick={() => setShowBulk(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Bulk Management
        </button>
        {showBulk && <BulkManagement onClose={() => setShowBulk(false)} onUploadSuccess={() => fetch(1)} />}
      </div>

      {/* Filters */}
      <div className="tracking-filters">
        <select className="filter-select" value={filters.product || ''} onChange={e => setFilters(f => ({ ...f, product: e.target.value || undefined }))}>
          <option value="">Shipping Partner</option>
          <option>DHL</option>
          <option>UPS</option>
        </select>
        <select className="filter-select" value={filters.warehouse || ''} onChange={e => setFilters(f => ({ ...f, warehouse: e.target.value || undefined }))}>
          <option value="">Warehouse</option>
          <option>Mumbai</option>
          <option>Delhi</option>
          <option>Bangalore</option>
        </select>
        <select className="filter-select" value={filters.shipmentType || ''} onChange={e => setFilters(f => ({ ...f, shipmentType: e.target.value || undefined }))}>
          <option value="">Shipment Type</option>
          <option>B2C</option>
          <option>B2B</option>
          <option>BBX</option>
        </select>
        <select className="filter-select" value={filters.tatStatus || ''} onChange={e => setFilters(f => ({ ...f, tatStatus: e.target.value || undefined }))}>
          <option value="">Shipment Status TAT</option>
          <option>Delayed</option>
          <option>On-time</option>
        </select>
        <select className="filter-select" value={filters.orderType || ''} onChange={e => setFilters(f => ({ ...f, orderType: e.target.value || undefined }))}>
          <option value="">Shipment Order Type</option>
          <option>COD Order</option>
          <option>Prepaid Order</option>
        </select>
        <select className="filter-select" value={filters.movementType || ''} onChange={e => setFilters(f => ({ ...f, movementType: e.target.value || undefined }))}>
          <option value="">Movement Order Type</option>
          <option>Forward</option>
          <option>Reverse</option>
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
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ height: '100%', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="tracking-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" /></th>
                <th>AWB No.</th>
                <th>Shipping Partner</th>
                <th>Booked Date</th>
                <th>Dispatch Date</th>
                <th>Week</th>
                <th>Source City</th>
                <th>Destination Country</th>
                <th>Delay Days</th>
                <th>Transit Days</th>
                <th>TAT</th>
                <th>Upload Date</th>
                <th>Logistics Type</th>
                <th>Shipment Type</th>
                <th>Source Country</th>
                <th>Source State</th>
                <th>Destination City</th>
                <th>Destination State</th>
                <th>Shipment Weight</th>
                <th>EDD</th>
                <th>Shipment Status Time</th>
                <th>Shipment Status Description</th>
                <th>Shipment Status Event</th>
                <th>Last Synced</th>
                <th>Shipment Status</th>
                <th>TAT Status</th>
                <th>POD Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={32} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={32} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>No shipments found</td></tr>
              ) : shipments.map((s, i) => (
                <tr key={s._id || i}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 600, color: '#0882ff', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/tracking/${s.awb}`)}>{s.awb}</td>
                  <td><span style={{ fontWeight: 700, color: '#c00', fontSize: 11, letterSpacing: 0.5 }}>{s.courier || 'DHL'}</span></td>
                  <td>{formatDate(s.shipmentDate)}</td>
                  <td>{s.dispatchDate ? formatDate(s.dispatchDate) : '-'}</td>
                  <td>{s.week || '-'}</td>
                  <td>{s.sourceCity || '-'}</td>
                  <td>{s.destCountry || s.destName || s.destCode || '-'}</td>
                  <td style={{ color: 'var(--gray-400)' }}>-</td>
                  <td>{s.trackingStatus?.daysInTransit || daysSince(s.dispatchDate)}</td>
                  <td>{s.tat || '-'}</td>
                  <td>{s.uploadDate ? formatDate(s.uploadDate) : '-'}</td>
                  <td>{s.logisticsType || '-'}</td>
                  <td>{s.shipmentType || '-'}</td>
                  <td>{s.sourceCountry || '-'}</td>
                  <td>{s.sourceState || '-'}</td>
                  <td>{s.destCity || '-'}</td>
                  <td>{s.destState || '-'}</td>
                  <td>{s.weight ? `${s.weight.toFixed(1)}` : '-'}</td>
                  <td>{s.edd ? formatDate(s.edd) : '-'}</td>
                  <td style={{ fontSize: 11 }}>{s.trackingStatus?.lastEventTime ? formatDate(s.trackingStatus.lastEventTime) : '-'}</td>
                  <td style={{ fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.trackingStatus?.lastEvent || '-'}</td>
                  <td style={{ fontSize: 11 }}>{s.trackingStatus?.currentMilestone || '-'}</td>
                  <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{timeSince(s.updatedAt)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td>{tatBadge()}</td>
                  <td>{naBadge()}</td>
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
