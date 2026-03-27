import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { formatDate } from '../utils/api';

const MILESTONE_ORDER = ['Booked', 'Picked Up', 'In Transit', 'Customs', 'Out for Delivery', 'Delivered', 'Failed', 'Returned'];

function buildTimeline(events, currentStatus) {
  if (!events || events.length === 0) {
    // No events from integration — just show current status
    return [{ milestone: currentStatus || 'Booked', events: [], completed: true, current: true }];
  }

  // Sort events oldest first to build timeline in order
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Group events by milestone, preserving order of first appearance
  const milestoneMap = new Map();
  for (const ev of sorted) {
    const m = ev.milestone || 'In Transit';
    if (!milestoneMap.has(m)) milestoneMap.set(m, []);
    milestoneMap.get(m).push(ev);
  }

  // Build timeline entries in the order milestones appeared
  const timeline = [];
  for (const [milestone, evts] of milestoneMap) {
    // Sort events within milestone newest first for display
    const displayEvents = [...evts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    timeline.push({ milestone, events: displayEvents, completed: true, current: false });
  }

  // Mark the last one as current
  if (timeline.length > 0) {
    timeline[timeline.length - 1].current = true;
  }

  return timeline;
}

export default function ShipmentDetail() {
  const { awb } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generalOpen, setGeneralOpen] = useState(true);
  const [invoiceOpen, setInvoiceOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/shipments/lookup/${awb}`)
      .then(r => {
        const data = Array.isArray(r.data) ? r.data[0] : r.data;
        setShipment(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [awb]);

  const timeSince = (date) => {
    if (!date) return '-';
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 60) return `${mins}mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}hrs ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const daysSince = (date) => {
    if (!date) return '-';
    const d = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return d >= 0 ? d : '-';
  };

  if (loading) {
    return (
      <div className="shipment-detail-page">
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading...</div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="shipment-detail-page">
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Shipment not found</div>
      </div>
    );
  }

  const s = shipment;
  const currentMilestone = s.trackingStatus?.currentMilestone || s.status || 'Booked';
  const events = s.trackingEvents || [];
  const timeline = buildTimeline(events, currentMilestone);
  const edd = s.edd ? formatDate(s.edd) : 'N/A';
  const isDelivered = currentMilestone === 'Delivered';
  const isFailed = currentMilestone === 'Failed' || currentMilestone === 'Returned';

  return (
    <div className="shipment-detail-page">
      {/* Breadcrumb + Header */}
      <div className="sd-breadcrumb">
        <span onClick={() => navigate('/tracking')} style={{ cursor: 'pointer', color: '#f57c00' }}>Shipments</span>
        <span style={{ margin: '0 6px', color: '#999' }}>&gt;</span>
        <span style={{ color: '#999' }}>details</span>
      </div>
      <div className="sd-header">
        <div className="sd-back" onClick={() => navigate('/tracking')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          <span>View Details- AWB: {s.awb}</span>
        </div>
      </div>

      <div className="sd-content">
        {/* Left: General Info + Invoice */}
        <div className="sd-left">
          {/* General Information */}
          <div className="sd-section">
            <div className="sd-section-header" onClick={() => setGeneralOpen(!generalOpen)}>
              <h3>General Information</h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: generalOpen ? 'rotate(0)' : 'rotate(180deg)', transition: '0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {generalOpen && (
              <div className="sd-grid">
                <div className="sd-field"><label>AWB No.</label><span>{s.awb}</span></div>
                <div className="sd-field"><label>Shipping Partner</label><span className="sd-courier-value">{s.courier || 'DHL'}</span></div>

                <div className="sd-field"><label>Booked Date</label><span>{formatDate(s.shipmentDate)}</span></div>
                <div className="sd-field"><label>Dispatch Date</label><span>{s.dispatchDate ? formatDate(s.dispatchDate) : '-'}</span></div>

                <div className="sd-field"><label>Week</label><span>{s.week || '-'}</span></div>
                <div className="sd-field"><label>Source City</label><span>{s.sourceCity || '-'}</span></div>

                <div className="sd-field"><label>Source State</label><span>{s.sourceState || '-'}</span></div>
                <div className="sd-field"><label>Source Country</label><span>{s.sourceCountry || '-'}</span></div>

                <div className="sd-field"><label>Destination City</label><span>{s.destCity || '-'}</span></div>
                <div className="sd-field"><label>Destination State</label><span>{s.destState || '-'}</span></div>

                <div className="sd-field"><label>Destination Country</label><span>{s.destCountry || s.destName || '-'}</span></div>
                <div className="sd-field"><label>Shipment Status</label><span>{currentMilestone.toUpperCase()}</span></div>

                <div className="sd-field"><label>Shipment Status Time</label><span>{s.trackingStatus?.lastEventTime ? formatDate(s.trackingStatus.lastEventTime) : '-'}</span></div>
                <div className="sd-field"><label>Shipment Status Description</label><span>{s.trackingStatus?.lastEvent || '-'}</span></div>

                <div className="sd-field"><label>EDD</label><span>{edd}</span></div>
                <div className="sd-field"><label>Shipment Weight</label><span>{s.weight || '-'}</span></div>

                <div className="sd-field"><label>Delay Days</label><span>{s.trackingStatus?.isDelayed ? daysSince(s.shipmentDate) : '-'}</span></div>
                <div className="sd-field"><label>Transit Days</label><span>{s.trackingStatus?.daysInTransit || daysSince(s.dispatchDate)}</span></div>

                <div className="sd-field"><label>TAT</label><span>{s.tat || s.trackingStatus?.daysInTransit || '-'}</span></div>
                <div className="sd-field"><label>Upload Date</label><span>{s.uploadDate ? formatDate(s.uploadDate) : '-'}</span></div>

                <div className="sd-field"><label>Logistics Type</label><span>{s.logisticsType || '-'}</span></div>
                <div className="sd-field"><label>Facility Code</label><span>{s.facilityCode || '-'}</span></div>

                <div className="sd-field"><label>Shipment Type</label><span>{s.shipmentType || '-'}</span></div>
                <div className="sd-field"><label>Facility Name</label><span>{s.facilityName || '-'}</span></div>

                <div className="sd-field"><label>Consignee Name</label><span>{s.receiverName || '-'}</span></div>
                <div className="sd-field"><label>Warehouse</label><span>{s.warehouse || '-'}</span></div>

                <div className="sd-field"><label>Movement Type</label><span>{s.movementType || '-'}</span></div>
                <div className="sd-field"><label>Shipment Status Event</label><span>{events[0]?.description || '-'}</span></div>

                <div className="sd-field"><label>Shipping Method</label><span>{s.shippingMethod || '-'}</span></div>
                <div className="sd-field"><label>Last Synced</label><span>{timeSince(s.trackingStatus?.lastTrackedAt || s.updatedAt)}</span></div>
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="sd-section">
            <div className="sd-section-header" onClick={() => setInvoiceOpen(!invoiceOpen)}>
              <h3>Invoice Details</h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: invoiceOpen ? 'rotate(0)' : 'rotate(180deg)', transition: '0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {invoiceOpen && (
              <table className="sd-invoice-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Invoice Date</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Product Name</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{s.invoiceNumber || 'NA'}</td>
                    <td>{s.invoiceDate ? formatDate(s.invoiceDate) : '-'}</td>
                    <td>{s.sku || '-'}</td>
                    <td>{s.pieces || '-'}</td>
                    <td>{s.productName || '-'}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Remarks */}
          <div className="sd-section">
            <h3 style={{ padding: '16px 20px', margin: 0, fontSize: 15, fontWeight: 700 }}>No Remarks</h3>
          </div>
        </div>

        {/* Right: Tracking Timeline */}
        <div className="sd-right">
          <div className="sd-tracking-card">
            <div className="sd-tracking-status">
              <span className={`sd-status-label ${isDelivered ? 'delivered' : isFailed ? 'failed' : 'active'}`}>
                {currentMilestone}
              </span>
              <span className={`sd-pending-badge ${isDelivered ? 'delivered' : isFailed ? 'failed' : ''}`}>
                {isDelivered ? 'DELIVERED' : isFailed ? 'FAILED' : 'PENDING'}
              </span>
            </div>
            <div className="sd-edd">
              <span>Expected delivery date</span>
              <strong>{edd}</strong>
            </div>

            {/* Timeline — built from actual integration events */}
            <div className="sd-timeline">
              {timeline.map((item, i) => (
                <div key={i} className={`sd-timeline-item completed ${item.current ? 'current' : ''}`}>
                  <div className="sd-timeline-dot">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  {i < timeline.length - 1 && <div className="sd-timeline-line completed" />}
                  <div className="sd-timeline-content">
                    <div className="sd-timeline-title">{item.milestone}</div>
                    {item.events.map((ev, j) => (
                      <div key={j} className="sd-timeline-event">
                        <div className="sd-timeline-event-desc">{ev.description}</div>
                        <div className="sd-timeline-event-loc">{ev.location}</div>
                        <div className="sd-timeline-event-time">
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions Button */}
      <button className="sd-actions-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Actions
      </button>
    </div>
  );
}
