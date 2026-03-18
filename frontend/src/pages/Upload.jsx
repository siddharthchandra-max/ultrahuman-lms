import React, { useState } from 'react';
import api from '../utils/api';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState('');
  const [sheet, setSheet] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file || !month) { setError('Please select a file and month'); return; }
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('month', month);
      if (sheet) formData.append('sheet', sheet);
      const { data } = await api.post('/upload/dhl', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Upload DHL Billing Data</h3></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
            Upload DHL billing Excel/CSV files to import shipment and invoice data into the system.
          </p>

          <div className="upload-area" onClick={() => document.getElementById('file-input').click()}>
            <input id="file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <div>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{'\u{1F4C4}'}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB — Click to change
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{'\u{2B06}\uFE0F'}</div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Click to select file</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Supports .xlsx, .xls, .csv (max 100MB)</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Month Label *</label>
              <select className="filter-select" style={{ width: '100%' }} value={month} onChange={e => setMonth(e.target.value)}>
                <option value="">Select month</option>
                <option>Sep'25</option><option>Oct'25</option><option>Nov'25</option>
                <option>Dec'25</option><option>Jan'26</option><option>Feb'26</option>
                <option>Mar'26</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Sheet Name (optional)</label>
              <input className="form-input" placeholder="e.g. Raw, Sheet1" value={sheet} onChange={e => setSheet(e.target.value)} />
            </div>
          </div>

          {error && <div className="error-msg" style={{ marginTop: 16 }}>{error}</div>}

          {result && (
            <div style={{ marginTop: 16, padding: 16, background: '#d1fae5', borderRadius: 8, fontSize: 13 }}>
              <strong>Import complete!</strong> {result.shipments?.toLocaleString()} shipments and {result.invoices?.toLocaleString()} invoices imported.
            </div>
          )}

          <button className="btn btn-primary" style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}
            onClick={handleUpload} disabled={uploading || !file || !month}>
            {uploading ? 'Uploading & Processing...' : 'Upload & Import'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Supported File Formats</h3></div>
        <div className="card-body">
          <table style={{ fontSize: 13 }}>
            <thead><tr><th>Format</th><th>Description</th><th>Required Columns</th></tr></thead>
            <tbody>
              <tr><td><span className="badge badge-green">XLSX</span></td><td>DHL Billing Excel</td><td>Shipment Number, Product Name, Total amount (incl. VAT)</td></tr>
              <tr><td><span className="badge badge-blue">CSV</span></td><td>DHL Billing CSV</td><td>Same as XLSX — auto-detected</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
