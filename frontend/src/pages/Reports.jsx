import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api, { formatINR } from '../utils/api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const COLORS = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#6366f1','#14b8a6','#e11d48','#84cc16','#a855f7'];

export default function Reports() {
  const [activeReport, setActiveReport] = useState('costs');
  const [costData, setCostData] = useState(null);
  const [countryCosts, setCountryCosts] = useState([]);
  const [productData, setProductData] = useState([]);
  const [duplicates, setDuplicates] = useState(null);
  const [month, setMonth] = useState('');

  useEffect(() => {
    const params = month ? { month } : {};
    api.get('/reports/cost-breakdown', { params }).then(r => setCostData(r.data)).catch(() => {});
    api.get('/dashboard/country-costs', { params }).then(r => setCountryCosts(r.data)).catch(() => {});
    api.get('/reports/product-analysis', { params }).then(r => setProductData(r.data)).catch(() => {});
    api.get('/dashboard/duplicates', { params }).then(r => setDuplicates(r.data)).catch(() => {});
  }, [month]);

  const costItems = costData ? [
    { label: 'Weight Charge', value: costData.weightCharge },
    { label: 'Fuel Surcharge', value: costData.fuelSurcharge },
    { label: 'Import/Export Duties', value: costData.importExportDuties },
    { label: 'Import/Export Taxes', value: costData.importExportTaxes },
    { label: 'Clearance Processing', value: costData.clearanceProcessing },
    { label: 'Duty Tax Paid', value: costData.dutyTaxPaid },
    { label: 'Remote Area Delivery', value: costData.remoteAreaDelivery },
    { label: 'Merchandise Process', value: costData.merchandiseProcess },
    { label: 'Bonded Storage', value: costData.bondedStorage },
    { label: 'Address Correction', value: costData.addressCorrection },
    { label: 'GoGreen Carbon', value: costData.goGreenCarbon },
    { label: 'Regulatory Charges', value: costData.regulatoryCharges },
    { label: 'Insurance', value: costData.insuranceCharge },
    { label: 'Total Extra Charges', value: costData.totalExtraCharges },
    { label: 'Total (Excl. VAT)', value: costData.totalExclVAT },
    { label: 'Total Tax', value: costData.totalTax },
    { label: 'Total (Incl. VAT)', value: costData.totalInclVAT },
  ].filter(c => c.value) : [];

  return (
    <div>
      <div className="filter-bar">
        <div className="tabs" style={{ marginBottom: 0, flex: 1 }}>
          {['costs', 'countries', 'products', 'duplicates'].map(r => (
            <div key={r} className={`tab${activeReport === r ? ' active' : ''}`} onClick={() => setActiveReport(r)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </div>
          ))}
        </div>
        <select className="filter-select" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">All Months</option>
          <option value="Dec'25">Dec'25</option>
          <option value="Jan'26">Jan'26</option>
          <option value="Feb'26">Feb'26</option>
        </select>
      </div>

      {/* Cost Breakdown */}
      {activeReport === 'costs' && costData && (
        <div>
          <div className="metric-grid cols-4">
            <div className="metric-card blue">
              <div className="metric-label">Total (Incl. VAT)</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(costData.totalInclVAT)}</div>
            </div>
            <div className="metric-card green">
              <div className="metric-label">Total (Excl. VAT)</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(costData.totalExclVAT)}</div>
            </div>
            <div className="metric-card orange">
              <div className="metric-label">Total Tax</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(costData.totalTax)}</div>
            </div>
            <div className="metric-card purple">
              <div className="metric-label">Extra Charges</div>
              <div className="metric-value" style={{ fontSize: 20 }}>{formatINR(costData.totalExtraCharges)}</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>Cost Breakdown</h3></div>
              <div className="card-body">
                <Bar data={{
                  labels: costItems.slice(0, 12).map(c => c.label),
                  datasets: [{ data: costItems.slice(0, 12).map(c => Math.abs(c.value)), backgroundColor: COLORS, borderRadius: 4 }]
                }} options={{ indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }} height={350} />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Cost Distribution</h3></div>
              <div className="card-body">
                <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Cost Type</th><th style={{ textAlign: 'right' }}>Amount (INR)</th></tr></thead>
                    <tbody>
                      {costItems.map(c => (
                        <tr key={c.label}><td>{c.label}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(c.value)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Country Costs */}
      {activeReport === 'countries' && (
        <div className="card">
          <div className="card-header"><h3>Country-wise Cost Analysis ({countryCosts.length} countries)</h3></div>
          <div className="card-body">
            <div className="table-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Country</th><th>Shipments</th><th>Weight Charge</th><th>Fuel</th>
                    <th>Duties</th><th>Taxes</th><th>Extra Charges</th>
                    <th>Excl. VAT</th><th>Tax</th><th>Incl. VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {countryCosts.map(c => (
                    <tr key={c.code}>
                      <td style={{ fontWeight: 500 }}>{c.name || c.code}</td>
                      <td>{c.count.toLocaleString()}</td>
                      <td>{formatINR(c.weightCharge)}</td>
                      <td>{formatINR(c.fuelSurcharge)}</td>
                      <td>{formatINR(c.importExportDuties)}</td>
                      <td>{formatINR(c.importExportTaxes)}</td>
                      <td>{formatINR(c.totalExtraCharges)}</td>
                      <td>{formatINR(c.totalExclVAT)}</td>
                      <td>{formatINR(c.totalTax)}</td>
                      <td style={{ fontWeight: 600 }}>{formatINR(c.totalInclVAT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Product Analysis */}
      {activeReport === 'products' && (
        <div>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>Product Analysis</h3></div>
              <div className="card-body">
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Product</th><th>Count</th><th>Weight</th><th>Avg Weight</th><th>Total Cost</th><th>Avg Cost</th><th>Countries</th></tr></thead>
                    <tbody>
                      {productData.map(p => (
                        <tr key={p._id}>
                          <td style={{ fontWeight: 500 }}>{p._id}</td>
                          <td>{p.count.toLocaleString()}</td>
                          <td>{p.totalWeight?.toFixed(0)} kg</td>
                          <td>{p.avgWeight?.toFixed(1)} kg</td>
                          <td>{formatINR(p.totalInclVAT)}</td>
                          <td>{formatINR(p.avgCost)}</td>
                          <td>{p.countryCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Shipments by Product</h3></div>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 300, height: 300 }}>
                  <Doughnut data={{
                    labels: productData.map(p => p._id),
                    datasets: [{ data: productData.map(p => p.count), backgroundColor: COLORS }]
                  }} options={{ plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates */}
      {activeReport === 'duplicates' && duplicates && (
        <div className="card">
          <div className="card-header"><h3>Duplicate Billing — {duplicates.total} AWBs billed multiple times</h3></div>
          <div className="card-body">
            <div className="table-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>AWB</th><th>Times Billed</th><th>Charge 1</th><th>Charge 2</th><th>Charge 3</th></tr></thead>
                <tbody>
                  {duplicates.duplicates?.map(d => (
                    <tr key={d._id}>
                      <td style={{ fontWeight: 500 }}>{d._id}</td>
                      <td><span className={`badge ${d.count >= 3 ? 'badge-red' : 'badge-orange'}`}>{d.count}x</span></td>
                      <td>{formatINR(d.charges?.[0])}</td>
                      <td>{formatINR(d.charges?.[1])}</td>
                      <td>{formatINR(d.charges?.[2])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
