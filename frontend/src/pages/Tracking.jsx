import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { formatINR, formatDate } from '../utils/api';

const MILESTONES = ['Booked', 'Picked Up', 'In Transit', 'Customs', 'Out for Delivery', 'Delivered'];

const milestoneIcon = (m) => {
  const icons = {
    'Booked': <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
    'Picked Up': <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    'In Transit': <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    'Customs': <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    'Out for Delivery': <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    'Delivered': <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  };
  return icons[m] || icons['In Transit'];
};

export default function Tracking() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.get('/tracking/summary/stats').then(r => setSummary(r.data)).catch(() => {});
    api.get('/tracking/alerts/list').then(r => setAlerts(r.data)).catch(() => {});
  }, []);

  // Auto-track if AWB in URL
  useEffect(() => {
    const awb = searchParams.get('awb');
    if (awb) {
      setSearch(awb);
      // Trigger tracking
      setLoading(true);
      setError('');
      api.get(`/tracking/${awb}`)
        .then(({ data }) => {
          setTrackingData(data);
          if (!data.found && (!data.tracking || data.tracking.length === 0)) {
            setError(data.error || 'No tracking data found');
          }
        })
        .catch(err => setError(err.response?.data?.error || 'Tracking failed'))
        .finally(() => setLoading(false));
    }
  }, [searchParams]);

  const handleTrack = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError('');
    setTrackingData(null);
    try {
      const { data } = await api.get(`/tracking/${search.trim()}`);
      setTrackingData(data);
      if (!data.found && (!data.tracking || data.tracking.length === 0)) {
        setError(data.error || 'No tracking data found for this AWB');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Tracking failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post('/tracking/refresh-active');
      alert(`Refreshed tracking for ${data.updated}/${data.total} shipments`);
      api.get('/tracking/summary/stats').then(r => setSummary(r.data));
      api.get('/tracking/alerts/list').then(r => setAlerts(r.data));
    } catch (err) {
      alert('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const getCurrentMilestoneIndex = () => {
    if (!trackingData?.trackingStatus?.currentMilestone) return -1;
    return MILESTONES.indexOf(trackingData.trackingStatus.currentMilestone);
  };

  const getMilestoneCount = (milestone) => {
    if (!summary?.byMilestone) return 0;
    const found = summary.byMilestone.find(m => m._id === milestone);
    return found?.count || 0;
  };

  return (
    <div>
      {/* Summary Cards */}
      <div className="metric-grid cols-6" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {[
          { label: 'Booked', color: 'orange', milestone: 'Booked' },
          { label: 'Picked Up', color: 'blue', milestone: 'Picked Up' },
          { label: 'In Transit', color: 'blue', milestone: 'In Transit' },
          { label: 'Customs', color: 'purple', milestone: 'Customs' },
          { label: 'Out for Delivery', color: 'orange', milestone: 'Out for Delivery' },
          { label: 'Delivered', color: 'green', milestone: 'Delivered' },
        ].map(s => (
          <div className={`metric-card ${s.color}`} key={s.label}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value">{getMilestoneCount(s.milestone).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Delayed Alert */}
      {summary?.delayedCount > 0 && (
        <div className="delayed-alert">
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span><strong>{summary.delayedCount}</strong> shipments delayed or stuck (no update in 48+ hours or 7+ days in transit)</span>
          <button className="btn btn-sm btn-secondary" onClick={handleRefreshAll} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="search-input"
                style={{ width: '100%', paddingLeft: 14, fontSize: 14, padding: '12px 16px' }}
                placeholder="Enter AWB number to track (e.g., 1234567890)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleTrack} disabled={loading} style={{ padding: '12px 28px' }}>
              {loading ? 'Tracking...' : 'Track Shipment'}
            </button>
          </div>
        </div>
      </div>

      {error && !trackingData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{error}</p>
            <p style={{ fontSize: 12, marginTop: 8, color: 'var(--gray-400)' }}>
              Make sure the AWB exists in the system or configure DHL_API_KEY for live tracking.
            </p>
          </div>
        </div>
      )}

      {/* Tracking Result */}
      {trackingData && (
        <div className="grid-2">
          {/* Timeline */}
          <div className="card">
            <div className="card-header">
              <h3>Tracking Timeline — {trackingData.awb}</h3>
              <span className={`badge ${trackingData.trackingStatus?.isDelivered ? 'badge-green' : trackingData.trackingStatus?.isDelayed ? 'badge-red' : 'badge-blue'}`}>
                {trackingData.trackingStatus?.currentMilestone || trackingData.shipment?.status || 'Unknown'}
              </span>
            </div>
            <div className="card-body">
              {/* Milestone Progress */}
              <div className="tracking-progress">
                {MILESTONES.map((m, i) => {
                  const currentIdx = getCurrentMilestoneIndex();
                  const isCompleted = i <= currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={m} className={`tracking-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                      <div className="step-icon">{milestoneIcon(m)}</div>
                      <div className="step-label">{m}</div>
                      {i < MILESTONES.length - 1 && <div className="step-line" />}
                    </div>
                  );
                })}
              </div>

              {/* Event List */}
              {trackingData.tracking && trackingData.tracking.length > 0 ? (
                <div className="tracking-timeline">
                  {trackingData.tracking.map((ev, i) => (
                    <div key={i} className={`timeline-node ${i === 0 ? 'current' : 'completed'}`}>
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-time">{new Date(ev.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="timeline-desc">{ev.description}</div>
                        {ev.location && <div className="timeline-location">{ev.location} {ev.locationCode ? `(${ev.locationCode})` : ''}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray-400)', fontSize: 13 }}>
                  No tracking events available. Configure <strong>DHL_API_KEY</strong> env var for live tracking from DHL.
                </div>
              )}
            </div>
          </div>

          {/* Shipment Details */}
          {trackingData.shipment && (
            <div className="card">
              <div className="card-header"><h3>Shipment Details</h3></div>
              <div className="card-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">AWB Number</div>
                    <div className="detail-value">{trackingData.shipment.awb}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Courier</div>
                    <div className="detail-value">{trackingData.shipment.courier || 'DHL'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Ship Date</div>
                    <div className="detail-value">{formatDate(trackingData.shipment.shipmentDate)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Month</div>
                    <div className="detail-value">{trackingData.shipment.month || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Destination</div>
                    <div className="detail-value">{trackingData.shipment.destName || trackingData.shipment.destCode || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Receiver</div>
                    <div className="detail-value">{trackingData.shipment.receiverName || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Product</div>
                    <div className="detail-value">{trackingData.shipment.productName || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Weight</div>
                    <div className="detail-value">{trackingData.shipment.weight ? `${trackingData.shipment.weight.toFixed(1)} kg` : '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Invoice</div>
                    <div className="detail-value">{trackingData.shipment.invoiceNumber || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Amount (Incl. VAT)</div>
                    <div className="detail-value">{formatINR(trackingData.shipment.totalInclVAT)}</div>
                  </div>
                  {trackingData.trackingStatus?.daysInTransit > 0 && (
                    <div className="detail-item">
                      <div className="detail-label">Days in Transit</div>
                      <div className="detail-value" style={{ color: trackingData.trackingStatus.daysInTransit > 7 ? 'var(--red)' : 'inherit' }}>
                        {trackingData.trackingStatus.daysInTransit} days
                      </div>
                    </div>
                  )}
                  {trackingData.trackingStatus?.estimatedDelivery && (
                    <div className="detail-item">
                      <div className="detail-label">Est. Delivery</div>
                      <div className="detail-value">{formatDate(trackingData.trackingStatus.estimatedDelivery)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts Table */}
      {alerts.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3>Delayed / Stuck Shipments ({alerts.length})</h3>
            <button className="btn btn-sm btn-secondary" onClick={handleRefreshAll} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>AWB</th><th>Destination</th><th>Ship Date</th><th>Days</th>
                    <th>Last Event</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(s => (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 600 }}>{s.awb}</td>
                      <td>{s.destName || s.destCode || '-'}</td>
                      <td>{formatDate(s.shipmentDate)}</td>
                      <td>
                        <span className={`badge ${s.trackingStatus?.daysInTransit > 10 ? 'badge-red' : 'badge-orange'}`}>
                          {s.trackingStatus?.daysInTransit || '?'} days
                        </span>
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.trackingStatus?.lastEvent || '-'}
                      </td>
                      <td><span className="badge badge-red">{s.trackingStatus?.currentMilestone || s.status}</span></td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => { setSearch(s.awb); }}>
                          Track
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No alerts + no search = empty state */}
      {!trackingData && alerts.length === 0 && !error && (
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" style={{ marginBottom: 16 }}>
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <h3 style={{ color: 'var(--gray-600)', marginBottom: 8, fontSize: 15 }}>Track Your Shipments</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
              Enter an AWB number above to see real-time tracking status, timeline, and shipment details.
              Upload DHL billing data first, then configure <strong>DHL_API_KEY</strong> for live tracking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
