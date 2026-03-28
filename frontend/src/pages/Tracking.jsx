import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatINR, formatDate } from '../utils/api';
import DateRangePicker from '../components/DateRangePicker';
import BulkManagement from '../components/BulkManagement';
import MultiSelect from '../components/MultiSelect';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Booked', label: 'Booked' },
  { key: 'Active', label: 'Active' },
  { key: 'Delivered', label: 'Delivered' },
];

const ACTIVE_SUB_TABS = [
  { key: '', label: 'All Active' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'Out for Delivery', label: 'Out for Delivery' },
  { key: 'Failed', label: 'Exception' },
];

export default function Tracking() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filterOpts, setFilterOpts] = useState({ products: [], countries: [], months: [], statuses: [] });
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState({});
  const [viewMode, setViewMode] = useState('AWB');
  const [dateFrom, setDateFrom] = useState('2026-03-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [colFilters, setColFilters] = useState({});
  const [colSort, setColSort] = useState({ col: null, dir: null }); // dir: 'asc' | 'desc'
  const [openColFilter, setOpenColFilter] = useState(null);
  const colFilterRef = useRef(null);
  const [omsSyncing, setOmsSyncing] = useState(false);
  const [omsSyncResult, setOmsSyncResult] = useState(null);

  useEffect(() => {
    api.get('/shipments/filters').then(r => setFilterOpts(r.data)).catch(() => {});
  }, []);

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 50, sortBy: 'shipmentDate', sortOrder: -1 };
      if (search) params.search = search;
      if (activeTab === 'Active') {
        if (activeSubTab) {
          params.status = activeSubTab;
        } else {
          params.status = 'In Transit,Picked Up,Customs,Out for Delivery,Failed';
        }
      } else if (activeTab) {
        params.status = activeTab;
      }
      if (filters.warehouse?.length) params.warehouse = filters.warehouse.join(',');
      if (filters.destCode) params.destCode = filters.destCode;
      if (filters.product) params.product = filters.product;
      if (filters.courier?.length) params.courier = filters.courier.join(',');
      if (filters.shipmentType?.length) params.shipmentType = filters.shipmentType.join(',');
      if (filters.logisticsType?.length) params.logisticsType = filters.logisticsType.join(',');
      if (filters.tatStatus?.length) params.tatStatus = filters.tatStatus.join(',');
      if (filters.movementType?.length) params.movementType = filters.movementType.join(',');
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await api.get('/shipments', { params });
      setShipments(data.shipments);
      setPagination(data.pagination);
      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, activeTab, activeSubTab, filters, dateFrom, dateTo]);

  useEffect(() => { fetch(1); }, [fetch]);

  const getTabCount = (key) => {
    const hasData = Object.keys(statusCounts).length > 0;
    if (!key) {
      // "All" = sum of all status counts, fallback to pagination total
      return hasData ? Object.values(statusCounts).reduce((a, b) => a + b, 0) : pagination.total;
    }
    if (key === 'Active') {
      return (statusCounts['In Transit'] || 0) + (statusCounts['Picked Up'] || 0) + (statusCounts['Customs'] || 0) + (statusCounts['Out for Delivery'] || 0) + (statusCounts['Failed'] || 0);
    }
    if (!hasData) {
      // Counts not loaded yet — if this tab is active, use pagination.total
      return activeTab === key ? pagination.total : 0;
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
    return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</span>;
  };

  const tatBadge = () => (
    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#fff3cd', color: '#856404' }}>PENDING</span>
  );

  const naBadge = () => (
    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>NA</span>
  );

  const calcTAT = (s) => {
    if (!s.dispatchDate) return '-';
    const dispatch = new Date(s.dispatchDate);
    // Use actual delivered date if delivered, otherwise EDD
    const endDate = s.trackingStatus?.isDelivered && s.trackingStatus?.lastEventTime
      ? new Date(s.trackingStatus.lastEventTime)
      : s.edd ? new Date(s.edd) : null;
    if (!endDate) return '-';
    const days = Math.round((endDate - dispatch) / (1000 * 60 * 60 * 24));
    return days >= 0 ? `${days}d` : '-';
  };

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

  const getWeek = (s) => s.week || (s.dispatchDate ? 'W' + Math.ceil(((new Date(s.dispatchDate) - new Date(new Date(s.dispatchDate).getFullYear(), 0, 1)) / 86400000 + new Date(new Date(s.dispatchDate).getFullYear(), 0, 1).getDay() + 1) / 7) : '-');

  const getColValue = (s, col) => {
    if (col === 'week') return getWeek(s);
    if (col === 'transitDays') { const v = s.trackingStatus?.daysInTransit ?? daysSince(s.dispatchDate); return v === '-' ? '-' : String(v); }
    if (col === 'delayDays') return '-';
    if (col === 'tat') return calcTAT(s);
    if (col === 'dispatchDate') return s.dispatchDate ? formatDate(s.dispatchDate) : '-';
    return '-';
  };

  const colFilterOptions = useMemo(() => {
    const opts = {};
    ['week', 'transitDays', 'delayDays', 'tat', 'dispatchDate'].forEach(col => {
      const vals = [...new Set(shipments.map(s => getColValue(s, col)))].filter(Boolean).sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
      opts[col] = vals;
    });
    return opts;
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const active = Object.entries(colFilters).filter(([, vals]) => vals.size > 0);
    let result = active.length === 0 ? [...shipments] : shipments.filter(s => active.every(([col, vals]) => vals.has(getColValue(s, col))));
    if (colSort.col && colSort.dir) {
      result = [...result].sort((a, b) => {
        let va = getColValue(a, colSort.col), vb = getColValue(b, colSort.col);
        if (va === '-') va = '';
        if (vb === '-') vb = '';
        const na = parseFloat(va), nb = parseFloat(vb);
        let cmp;
        if (!isNaN(na) && !isNaN(nb)) { cmp = na - nb; }
        else if (colSort.col === 'dispatchDate') { cmp = new Date(a.dispatchDate || 0) - new Date(b.dispatchDate || 0); }
        else { cmp = String(va).localeCompare(String(vb)); }
        return colSort.dir === 'desc' ? -cmp : cmp;
      });
    }
    return result;
  }, [shipments, colFilters, colSort]);

  // Close column filter on outside click
  useEffect(() => {
    const handler = (e) => {
      if (colFilterRef.current && !colFilterRef.current.contains(e.target)) setOpenColFilter(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleColFilter = (col, val) => {
    setColFilters(prev => {
      const s = new Set(prev[col] || []);
      s.has(val) ? s.delete(val) : s.add(val);
      return { ...prev, [col]: s };
    });
  };

  const clearColFilter = (col) => setColFilters(prev => ({ ...prev, [col]: new Set() }));

  const ColFilterHeader = ({ label, col }) => (
    <th style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span
          style={{ cursor: 'pointer', opacity: (colFilters[col]?.size || (colSort.col === col)) ? 1 : 0.4, fontSize: 10 }}
          onClick={(e) => { e.stopPropagation(); setOpenColFilter(openColFilter === col ? null : col); }}
        >{colSort.col === col ? (colSort.dir === 'asc' ? '↑' : '↓') : '▼'}</span>
      </div>
      {openColFilter === col && (
        <div ref={colFilterRef} className="col-filter-dropdown" onClick={e => e.stopPropagation()}>
          <div className="col-filter-sort">
            <div
              className={`col-sort-btn ${colSort.col === col && colSort.dir === 'asc' ? 'active' : ''}`}
              onClick={() => setColSort(colSort.col === col && colSort.dir === 'asc' ? { col: null, dir: null } : { col, dir: 'asc' })}
            >↑ Low to High</div>
            <div
              className={`col-sort-btn ${colSort.col === col && colSort.dir === 'desc' ? 'active' : ''}`}
              onClick={() => setColSort(colSort.col === col && colSort.dir === 'desc' ? { col: null, dir: null } : { col, dir: 'desc' })}
            >↓ High to Low</div>
          </div>
          <div className="col-filter-header">
            <span style={{ fontWeight: 600, fontSize: 11 }}>Filter {label}</span>
            <span style={{ cursor: 'pointer', color: '#0882ff', fontSize: 10 }} onClick={() => clearColFilter(col)}>Clear</span>
          </div>
          <div className="col-filter-list">
            {(colFilterOptions[col] || []).map(val => (
              <label key={val} className="col-filter-item">
                <input type="checkbox" checked={colFilters[col]?.has(val) || false} onChange={() => toggleColFilter(col, val)} />
                <span>{val}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </th>
  );

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-oms-sync" disabled={omsSyncing} onClick={async () => {
            setOmsSyncing(true); setOmsSyncResult(null);
            try {
              await api.post('/tracking/metabase-sync');
              setOmsSyncResult('Sync started — importing shipments from OMS...');
              setTimeout(() => { fetch(1); setOmsSyncResult(null); }, 15000);
            } catch (err) { setOmsSyncResult('Sync failed: ' + (err.response?.data?.error || err.message)); }
            setOmsSyncing(false);
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            {omsSyncing ? 'Syncing...' : 'Sync OMS'}
          </button>
          <button className="btn-bulk-mgmt" onClick={() => setShowBulk(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Bulk Management
          </button>
        </div>
        {omsSyncResult && <div className="oms-sync-status">{omsSyncResult}</div>}
        {showBulk && <BulkManagement onClose={() => setShowBulk(false)} onUploadSuccess={() => fetch(1)} />}
      </div>

      {/* Filters */}
      <div className="tracking-filters">
        <MultiSelect label="Shipping Partner" options={['UPS', 'DHL', 'BlueDart', 'FedEx']} selected={filters.courier || []} onChange={v => setFilters(f => ({ ...f, courier: v.length ? v : undefined }))} />
        <MultiSelect label="Warehouse" options={['BLR', 'UK', 'USA', 'NL', 'ROW']} selected={filters.warehouse || []} onChange={v => setFilters(f => ({ ...f, warehouse: v.length ? v : undefined }))} />
        <MultiSelect label="Shipment Type" options={['B2C', 'B2B', 'BBX']} selected={filters.shipmentType || []} onChange={v => setFilters(f => ({ ...f, shipmentType: v.length ? v : undefined }))} />
        <MultiSelect label="Shipment Status TAT" options={['Delayed', 'On-time']} selected={filters.tatStatus || []} onChange={v => setFilters(f => ({ ...f, tatStatus: v.length ? v : undefined }))} />
        <MultiSelect label="Shipment Order Type" options={['COD Order', 'Prepaid Order']} selected={filters.orderType || []} onChange={v => setFilters(f => ({ ...f, orderType: v.length ? v : undefined }))} />
        <MultiSelect label="Movement Order Type" options={['Forward', 'Reverse']} selected={filters.movementType || []} onChange={v => setFilters(f => ({ ...f, movementType: v.length ? v : undefined }))} />
        <MultiSelect label="Logistics Type" options={['Cross Border', 'Domestic']} selected={filters.logisticsType || []} onChange={v => setFilters(f => ({ ...f, logisticsType: v.length ? v : undefined }))} />
      </div>

      {/* Status Tabs */}
      <div className="tracking-tabs">
        {STATUS_TABS.map(t => (
          <div
            key={t.key}
            className={`tracking-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.key); setActiveSubTab(''); }}
          >
            {t.label} <span className="tracking-tab-count">{getTabCount(t.key).toLocaleString()}</span>
          </div>
        ))}
        {activeTab === 'Active' && ACTIVE_SUB_TABS.map(st => (
          <div
            key={st.key}
            className={`tracking-tab sub-tab ${activeSubTab === st.key ? 'active' : ''}`}
            onClick={() => setActiveSubTab(st.key)}
          >
            {st.label} <span className="tracking-tab-count">{st.key ? (statusCounts[st.key] || 0).toLocaleString() : getTabCount('Active').toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '12px 16px 0' }}>
        <div className="table-wrap" style={{ height: '100%', overflowY: 'auto', overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e8ed' }}>
          <table className="tracking-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" /></th>
                <th>AWB No.</th>
                <th>Shipping Partner</th>
                <th>Booked Date</th>
                <ColFilterHeader label="Dispatch Date" col="dispatchDate" />
                <ColFilterHeader label="Week" col="week" />
                <th>Source City</th>
                <th>Destination Country</th>
                <ColFilterHeader label="Delay Days" col="delayDays" />
                <ColFilterHeader label="Transit Days" col="transitDays" />
                <ColFilterHeader label="TAT" col="tat" />
                <th>Upload Date</th>
                <th>Logistics Type</th>
                <th>Shipment Type</th>
                <th>Source Country</th>
                <th>Source State</th>
                <th>Destination City</th>
                <th>Destination State</th>
                <th>Shipment Weight</th>
                <th>Estimated Delivery Date</th>
                <th>Actual Delivery Date</th>
                <th>Shipment Status Time</th>
                <th>Shipment Status Description</th>
                <th>Shipment Status Event</th>
                <th>Last Synced</th>
                <th>Shipment Status</th>
                <th>Shipment Status TAT</th>
                <th>POD Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={32} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={32} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>No shipments found</td></tr>
              ) : filteredShipments.map((s, i) => (
                <tr key={s._id || i}>
                  <td><input type="checkbox" /></td>
                  <td className="td-awb" onClick={() => navigate(`/tracking/${s.awb}`)}>{s.awb}</td>
                  <td className="td-courier">{s.courier || 'DHL'}</td>
                  <td>{s.shipmentDate ? formatDate(s.shipmentDate) : '-'}</td>
                  <td>{s.dispatchDate ? formatDate(s.dispatchDate) : '-'}</td>
                  <td>{getWeek(s)}</td>
                  <td>{s.sourceCity || '-'}</td>
                  <td>{s.destCountry || s.destName || s.destCode || '-'}</td>
                  <td style={{ color: 'var(--gray-400)' }}>-</td>
                  <td>{s.trackingStatus?.daysInTransit ?? daysSince(s.dispatchDate)}</td>
                  <td>{calcTAT(s)}</td>
                  <td>{s.uploadDate ? formatDate(s.uploadDate) : '-'}</td>
                  <td>{s.logisticsType || '-'}</td>
                  <td>{s.shipmentType || '-'}</td>
                  <td>{s.sourceCountry || '-'}</td>
                  <td>{s.sourceState || '-'}</td>
                  <td>{s.destCity || '-'}</td>
                  <td>{s.destState || '-'}</td>
                  <td>{s.weight ? `${s.weight.toFixed(1)}` : '-'}</td>
                  <td>{s.edd ? formatDate(s.edd) : '-'}</td>
                  <td>{s.trackingStatus?.isDelivered && s.trackingStatus?.lastEventTime ? formatDate(s.trackingStatus.lastEventTime) : '-'}</td>
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
      <div className="tracking-pagination">
        <span className="tracking-pagination-info">Showing {((pagination.page - 1) * 50) + 1}–{Math.min(pagination.page * 50, pagination.total)} of {pagination.total.toLocaleString()}</span>
        <div className="tracking-pagination-controls">
          <button className="tracking-page-btn" onClick={() => fetch(pagination.page - 1)} disabled={pagination.page <= 1}>← Prev</button>
          <span className="tracking-page-num">Page {pagination.page} of {pagination.pages}</span>
          <button className="tracking-page-btn" onClick={() => fetch(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next →</button>
        </div>
      </div>
    </div>
  );
}
