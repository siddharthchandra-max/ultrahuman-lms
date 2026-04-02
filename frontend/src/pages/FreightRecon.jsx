import React, { useState, useEffect, useCallback } from 'react';
import api, { formatINR } from '../utils/api';

const COURIERS = ['DHL', 'UPS', 'BlueDart', 'FedEx'];

function formatCr(val) {
  if (!val) return '0';
  if (val >= 10000000) return (val / 10000000).toFixed(2) + 'Cr';
  if (val >= 100000) return (val / 100000).toFixed(2) + 'L';
  return val.toLocaleString('en-IN');
}

export default function FreightRecon() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [surcharges, setSurcharges] = useState([]);
  const [zoneRates, setZoneRates] = useState([]);
  const [courier, setCourier] = useState('');
  const [month, setMonth] = useState('');
  const [months, setMonths] = useState([]);

  useEffect(() => {
    api.get('/shipments/filters').then(r => setMonths(r.data.months || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (courier) params.courier = courier;
      if (month) params.month = month;

      const [summaryRes, surchargeRes, rateRes] = await Promise.all([
        api.get('/recon/summary', { params }),
        api.get('/recon/surcharges', { params: { courier, month } }),
        api.get('/recon/zone-rates', { params: { courier } }),
      ]);

      setSummary(summaryRes.data);
      setSurcharges(surchargeRes.data.services || []);
      setZoneRates(rateRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [courier, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = summary?.totals || {};
  const commercial = summary?.commercialSummary || [];
  const zoneMix = summary?.zoneMix || [];
  const totalZone = zoneMix.reduce((s, z) => s + z.count, 0);

  // Zone mix colors
  const zoneColors = ['#6c5ce7', '#0984e3', '#00b894', '#fdcb6e', '#e17055', '#d63031', '#a29bfe', '#74b9ff', '#55efc4', '#ffeaa7', '#fab1a0', '#ff7675'];

  return (
    <div className="recon-page">
      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select className="filter-select" value={courier} onChange={e => setCourier(e.target.value)}>
          <option value="">All Couriers</option>
          {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
<select className="filter-select" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--gray-400)' }}>Loading reconciliation data...</div>
      ) : (
        <>
          {/* Row 1: Summary Cards + Zone Mix */}
          <div className="recon-top-row">
            <div className="recon-cards-col">
              <div className="recon-summary-grid">
                <div className="recon-card">
                  <div className="recon-card-label">Total Orders Shipped</div>
                  <div className="recon-card-value">{(totals.totalOrders || 0).toLocaleString()}</div>
                </div>
                <div className="recon-card">
                  <div className="recon-card-label">{courier || 'All'} AOC</div>
                  <div className="recon-card-value">{totals.avgOrderCost ? formatINR(Math.round(totals.avgOrderCost)) : '0'}</div>
                </div>
                <div className="recon-card">
                  <div className="recon-card-label">Total Shipment Cost Excl GST</div>
                  <div className="recon-card-value">{formatCr(totals.totalCostExclGST || 0)}</div>
                </div>
                <div className="recon-card">
                  <div className="recon-card-label">Charge Discrepancy %</div>
                  <div className="recon-card-value" style={{ color: parseFloat(summary?.discrepancyPct || 0) > 0 ? '#ef4444' : '#10b981' }}>
                    {summary?.discrepancyPct || '0'}%
                  </div>
                </div>
              </div>
            </div>

            <div className="recon-zone-col">
              <div className="card" style={{ height: '100%' }}>
                <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13 }}>Zone Mix</div>
                <div className="zone-chart">
                  {/* Simple horizontal bar chart */}
                  {zoneMix.slice(0, 12).map((z, i) => {
                    const pct = totalZone > 0 ? ((z.count / totalZone) * 100) : 0;
                    return (
                      <div key={z._id || 'unknown'} className="zone-bar-row">
                        <div className="zone-bar-label">{z._id || 'Unknown'}</div>
                        <div className="zone-bar-track">
                          <div className="zone-bar-fill" style={{ width: `${pct}%`, background: zoneColors[i % zoneColors.length] }} />
                        </div>
                        <div className="zone-bar-pct">{pct.toFixed(1)}%</div>
                        <div className="zone-bar-count">{z.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Commercial Summary Table */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--gray-200)' }}>
              Commercial Summary
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                    <th style={{ textAlign: 'right' }}>Actual Charge</th>
                    <th style={{ textAlign: 'right' }}>Expected Charge</th>
                    <th style={{ textAlign: 'right' }}>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {commercial.map(row => (
                    <tr key={row.status}>
                      <td>
                        <span className={`badge ${row.status === 'Match' ? 'badge-green' : row.status === 'Charged Less' ? 'badge-blue' : row.status === 'Charged More' ? 'badge-red' : 'badge-orange'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{row.count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{row.actualCharge.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>{row.expectedCharge.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: row.difference > 0 ? '#ef4444' : row.difference < 0 ? '#10b981' : undefined }}>
                        {row.difference.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {commercial.length > 0 && (
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--gray-300)' }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right' }}>{commercial.reduce((s, r) => s + r.count, 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{commercial.reduce((s, r) => s + r.actualCharge, 0).toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>{commercial.reduce((s, r) => s + r.expectedCharge, 0).toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444' }}>{commercial.reduce((s, r) => s + r.difference, 0).toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 3: Zone Rate Cards + Services & Surcharges side by side */}
          <div className="recon-bottom-row">
            {/* Zone Rate Cards */}
            <div className="card">
              <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--gray-200)' }}>
                {courier || 'DHL'} Rate Card
              </div>
              {zoneRates.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                  No rate cards configured. Upload rate cards to enable reconciliation.
                </div>
              ) : (
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th>Business</th>
                        <th>Fuel %</th>
                        {zoneRates[0]?.weightSlabs?.map((ws, i) => (
                          <th key={i} style={{ textAlign: 'right' }}>{ws.minWeight}-{ws.maxWeight}kg</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {zoneRates.map(rc => (
                        <tr key={rc._id}>
                          <td style={{ fontWeight: 600 }}>{rc.zone}</td>
                          <td>{rc.businessType}</td>
                          <td>{rc.fuelSurchargePercent}%</td>
                          {rc.weightSlabs?.map((ws, i) => (
                            <td key={i} style={{ textAlign: 'right' }}>{ws.rate.toLocaleString('en-IN')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Services & Surcharges */}
            <div className="card">
              <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--gray-200)' }}>
                Services & Surcharges
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surcharges.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No surcharge data</td></tr>
                    ) : surcharges.map(s => (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 500, fontSize: 12 }}>{s.name}</td>
                        <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{s.type}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatINR(s.total)}</td>
                      </tr>
                    ))}
                    {surcharges.length > 0 && (
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--gray-300)' }}>
                        <td>Total</td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>{formatINR(surcharges.reduce((s, r) => s + r.total, 0))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
