import React, { useState, useEffect, useCallback } from 'react';
import api, { formatINR, formatDate } from '../utils/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/invoices/summary').then(r => setSummary(r.data)).catch(() => {}); }, []);

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (filters.month) params.month = filters.month;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/invoices', { params });
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, filters]);

  useEffect(() => { fetch(1); }, [fetch]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/invoices/${id}`, { status });
      fetch(pagination.page);
    } catch (err) { console.error(err); }
  };

  const statusBadge = (s) => {
    const map = { Paid: 'badge-green', Verified: 'badge-blue', Disputed: 'badge-red', Pending: 'badge-orange' };
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s}</span>;
  };

  return (
    <div>
      {summary && (
        <div className="metric-grid cols-4">
          <div className="metric-card blue">
            <div className="metric-label">Total Invoices</div>
            <div className="metric-value">{summary.totals?.total?.toLocaleString() || 0}</div>
          </div>
          <div className="metric-card green">
            <div className="metric-label">Total Amount</div>
            <div className="metric-value" style={{ fontSize: 22 }}>{formatINR(summary.totals?.totalAmount)}</div>
          </div>
          {summary.byStatus?.map(s => (
            <div key={s._id} className={`metric-card ${s._id === 'Pending' ? 'orange' : s._id === 'Paid' ? 'green' : 'purple'}`}>
              <div className="metric-label">{s._id}</div>
              <div className="metric-value">{s.count}</div>
              <div className="metric-sub">{formatINR(s.amount)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <input className="search-input" placeholder="Search invoice number..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filters.status || ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
          <option value="">All Status</option>
          <option>Pending</option><option>Verified</option><option>Disputed</option><option>Paid</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th><th>Date</th><th>Due Date</th><th>Station</th>
                <th>Shipments</th><th>Excl. VAT</th><th>Tax</th><th>Incl. VAT</th>
                <th>Month</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>No invoices found</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv._id}>
                  <td style={{ fontWeight: 500 }}>{inv.invoiceNumber}</td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td>{formatDate(inv.dueDate)}</td>
                  <td>{inv.stationCode || '-'}</td>
                  <td>{inv.shipmentCount}</td>
                  <td>{formatINR(inv.totalExclVAT)}</td>
                  <td>{formatINR(inv.totalTax)}</td>
                  <td style={{ fontWeight: 600 }}>{formatINR(inv.totalInclVAT)}</td>
                  <td>{inv.month}</td>
                  <td>{statusBadge(inv.status)}</td>
                  <td>
                    <select className="filter-select" style={{ padding: '4px 8px', fontSize: 11 }} value={inv.status} onChange={e => updateStatus(inv._id, e.target.value)}>
                      <option>Pending</option><option>Verified</option><option>Disputed</option><option>Paid</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pagination">
        <span>{pagination.total} invoices</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetch(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
          <span style={{ padding: '6px 12px', fontSize: 13 }}>Page {pagination.page} / {pagination.pages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => fetch(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next</button>
        </div>
      </div>
    </div>
  );
}
