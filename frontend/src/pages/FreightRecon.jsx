import React, { useState, useEffect, useCallback } from 'react';
import api, { formatINR, formatDate } from '../utils/api';

const COURIERS = ['All', 'DHL', 'UPS', 'BlueDart', 'FedEx'];

export default function FreightRecon() {
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courier, setCourier] = useState('All');
  const [month, setMonth] = useState('');
  const [months, setMonths] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [sortBy, setSortBy] = useState('shipmentDate');
  const [sortOrder, setSortOrder] = useState(-1);

  useEffect(() => {
    api.get('/shipments/filters').then(r => setMonths(r.data.months || [])).catch(() => {});
  }, []);

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 50, sortBy, sortOrder };
      if (search) params.search = search;
      if (courier !== 'All') params.courier = courier;
      if (month) params.month = month;
      const { data } = await api.get('/shipments', { params });
      setShipments(data.shipments || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });

      // Calculate summary from current page data
      const all = data.shipments || [];
      const totalFreight = all.reduce((s, r) => s + (r.totalExclVAT || 0), 0);
      const totalTax = all.reduce((s, r) => s + (r.totalTax || 0), 0);
      const totalInclVAT = all.reduce((s, r) => s + (r.totalInclVAT || 0), 0);
      const totalFuel = all.reduce((s, r) => s + (r.fuelSurcharge || 0), 0);
      const totalDuties = all.reduce((s, r) => s + (r.importExportDuties || 0) + (r.importExportTaxes || 0), 0);
      const totalExtra = all.reduce((s, r) => s + (r.totalExtraCharges || 0), 0);
      const withCharges = all.filter(r => r.totalExclVAT > 0).length;
      const withoutCharges = all.filter(r => !r.totalExclVAT || r.totalExclVAT === 0).length;
      setSummary({ totalFreight, totalTax, totalInclVAT, totalFuel, totalDuties, totalExtra, withCharges, withoutCharges, total: data.pagination?.total || 0 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, courier, month, sortBy, sortOrder]);

  useEffect(() => { fetch(1); }, [fetch]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(o => o === -1 ? 1 : -1);
    } else {
      setSortBy(col);
      setSortOrder(-1);
    }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, fontSize: 10 }}>⇅</span>;
    return <span style={{ fontSize: 10 }}>{sortOrder === -1 ? '↓' : '↑'}</span>;
  };

  const reconStatus = (s) => {
    if (!s.invoiceNumber) return <span className="badge badge-gray">No Invoice</span>;
    if (!s.totalExclVAT || s.totalExclVAT === 0) return <span className="badge badge-orange">Unbilled</span>;
    if (s.totalExtraCharges > 0) return <span className="badge badge-red">Has Extras</span>;
    return <span className="badge badge-green">Matched</span>;
  };

  return (
    <div>
      {/* Summary Cards */}
      {summary && (
        <div className="metric-grid cols-4">
          <div className="metric-card blue">
            <div className="metric-label">Total Shipments</div>
            <div className="metric-value">{summary.total.toLocaleString()}</div>
            <div className="metric-sub">{summary.withCharges} billed / {summary.withoutCharges} unbilled</div>
          </div>
          <div className="metric-card green">
            <div className="metric-label">Total Freight (Excl. VAT)</div>
            <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(summary.totalFreight)}</div>
            <div className="metric-sub">Tax: {formatINR(summary.totalTax)}</div>
          </div>
          <div className="metric-card purple">
            <div className="metric-label">Fuel Surcharge</div>
            <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(summary.totalFuel)}</div>
            <div className="metric-sub">Duties: {formatINR(summary.totalDuties)}</div>
          </div>
          <div className="metric-card orange">
            <div className="metric-label">Extra Charges</div>
            <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(summary.totalExtra)}</div>
            <div className="metric-sub">Total Incl. VAT: {formatINR(summary.totalInclVAT)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <input className="search-input" placeholder="Search AWB, Invoice #..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COURIERS.map(c => (
            <button key={c} className={`filter-chip ${courier === c ? 'active' : ''}`} onClick={() => setCourier(c)}>{c}</button>
          ))}
        </div>
        <select className="filter-select" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th onClick={() => handleSort('awb')} style={{ cursor: 'pointer' }}>AWB {sortIcon('awb')}</th>
                <th onClick={() => handleSort('shipmentDate')} style={{ cursor: 'pointer' }}>Ship Date {sortIcon('shipmentDate')}</th>
                <th>Courier</th>
                <th>Invoice #</th>
                <th>Dest</th>
                <th onClick={() => handleSort('weight')} style={{ cursor: 'pointer' }}>Weight {sortIcon('weight')}</th>
                <th onClick={() => handleSort('weightCharge')} style={{ cursor: 'pointer' }}>Weight Charge {sortIcon('weightCharge')}</th>
                <th onClick={() => handleSort('fuelSurcharge')} style={{ cursor: 'pointer' }}>Fuel {sortIcon('fuelSurcharge')}</th>
                <th onClick={() => handleSort('totalExtraCharges')} style={{ cursor: 'pointer' }}>Extras {sortIcon('totalExtraCharges')}</th>
                <th onClick={() => handleSort('totalExclVAT')} style={{ cursor: 'pointer' }}>Excl. VAT {sortIcon('totalExclVAT')}</th>
                <th onClick={() => handleSort('totalTax')} style={{ cursor: 'pointer' }}>Tax {sortIcon('totalTax')}</th>
                <th onClick={() => handleSort('totalInclVAT')} style={{ cursor: 'pointer' }}>Incl. VAT {sortIcon('totalInclVAT')}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>Loading...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={14} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>No shipments found</td></tr>
              ) : shipments.map(s => (
                <React.Fragment key={s._id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === s._id ? null : s._id)}>
                    <td style={{ fontSize: 10, color: 'var(--gray-400)' }}>{expandedRow === s._id ? '▼' : '▶'}</td>
                    <td style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>{s.awb || '-'}</td>
                    <td style={{ fontSize: 12 }}>{s.shipmentDate ? formatDate(s.shipmentDate) : '-'}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{s.courier || '-'}</span></td>
                    <td style={{ fontSize: 12 }}>{s.invoiceNumber || '-'}</td>
                    <td style={{ fontSize: 12 }}>{s.destCode || s.destCity || '-'}</td>
                    <td style={{ fontSize: 12 }}>{s.weight ? `${s.weight.toFixed(1)} kg` : '-'}</td>
                    <td style={{ fontSize: 12 }}>{formatINR(s.weightCharge)}</td>
                    <td style={{ fontSize: 12 }}>{formatINR(s.fuelSurcharge)}</td>
                    <td style={{ fontSize: 12, color: s.totalExtraCharges > 0 ? '#ef4444' : undefined, fontWeight: s.totalExtraCharges > 0 ? 600 : undefined }}>
                      {formatINR(s.totalExtraCharges)}
                    </td>
                    <td style={{ fontSize: 12 }}>{formatINR(s.totalExclVAT)}</td>
                    <td style={{ fontSize: 12 }}>{formatINR(s.totalTax)}</td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{formatINR(s.totalInclVAT)}</td>
                    <td>{reconStatus(s)}</td>
                  </tr>
                  {expandedRow === s._id && (
                    <tr className="expanded-row">
                      <td colSpan={14}>
                        <div className="recon-detail">
                          <div className="recon-detail-grid">
                            <div className="recon-detail-section">
                              <h4>Shipment Info</h4>
                              <div className="recon-field"><label>AWB</label><span>{s.awb || '-'}</span></div>
                              <div className="recon-field"><label>Shipment #</label><span>{s.shipmentNumber || '-'}</span></div>
                              <div className="recon-field"><label>Invoice #</label><span>{s.invoiceNumber || '-'}</span></div>
                              <div className="recon-field"><label>Product</label><span>{s.productName || s.product || '-'}</span></div>
                              <div className="recon-field"><label>Courier</label><span>{s.courier || '-'}</span></div>
                              <div className="recon-field"><label>Origin</label><span>{s.originName || s.originCode || '-'}</span></div>
                              <div className="recon-field"><label>Destination</label><span>{s.destName || s.destCode || '-'} ({s.destCity || '-'})</span></div>
                              <div className="recon-field"><label>Weight</label><span>{s.weight ? `${s.weight.toFixed(2)} kg` : '-'}</span></div>
                              <div className="recon-field"><label>Pieces</label><span>{s.pieces || '-'}</span></div>
                            </div>
                            <div className="recon-detail-section">
                              <h4>Charge Breakdown</h4>
                              <div className="recon-field"><label>Weight Charge</label><span>{formatINR(s.weightCharge)}</span></div>
                              <div className="recon-field"><label>Fuel Surcharge</label><span>{formatINR(s.fuelSurcharge)}</span></div>
                              <div className="recon-field"><label>Import/Export Duties</label><span>{formatINR(s.importExportDuties)}</span></div>
                              <div className="recon-field"><label>Import/Export Taxes</label><span>{formatINR(s.importExportTaxes)}</span></div>
                              <div className="recon-field"><label>Clearance Processing</label><span>{formatINR(s.clearanceProcessing)}</span></div>
                              <div className="recon-field"><label>Duty Tax Paid</label><span>{formatINR(s.dutyTaxPaid)}</span></div>
                              <div className="recon-field"><label>Remote Area Delivery</label><span style={{ color: s.remoteAreaDelivery > 0 ? '#ef4444' : undefined }}>{formatINR(s.remoteAreaDelivery)}</span></div>
                              <div className="recon-field"><label>Merchandise Process</label><span>{formatINR(s.merchandiseProcess)}</span></div>
                              <div className="recon-field"><label>Bonded Storage</label><span>{formatINR(s.bondedStorage)}</span></div>
                              <div className="recon-field"><label>Address Correction</label><span style={{ color: s.addressCorrection > 0 ? '#ef4444' : undefined }}>{formatINR(s.addressCorrection)}</span></div>
                              <div className="recon-field"><label>Go Green Carbon</label><span>{formatINR(s.goGreenCarbon)}</span></div>
                              <div className="recon-field"><label>Regulatory Charges</label><span>{formatINR(s.regulatoryCharges)}</span></div>
                              <div className="recon-field"><label>Insurance</label><span>{formatINR(s.insuranceCharge)}</span></div>
                            </div>
                            <div className="recon-detail-section">
                              <h4>Totals</h4>
                              <div className="recon-field"><label>Extra Charges</label><span style={{ color: s.totalExtraCharges > 0 ? '#ef4444' : undefined, fontWeight: 600 }}>{formatINR(s.totalExtraCharges)}</span></div>
                              <div className="recon-field"><label>Total Excl. VAT</label><span style={{ fontWeight: 600 }}>{formatINR(s.totalExclVAT)}</span></div>
                              <div className="recon-field"><label>Tax</label><span>{formatINR(s.totalTax)}</span></div>
                              <div className="recon-field total"><label>Total Incl. VAT</label><span>{formatINR(s.totalInclVAT)}</span></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span>{pagination.total} shipments</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetch(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
          <span style={{ padding: '6px 12px', fontSize: 13 }}>Page {pagination.page} / {pagination.pages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => fetch(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next</button>
        </div>
      </div>
    </div>
  );
}
