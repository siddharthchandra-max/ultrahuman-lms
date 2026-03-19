import React, { useState, useRef } from 'react';

const TABS = ['Edit Bulk Shipments', 'Disable Bulk Shipments', 'Update Bulk Status'];

export default function BulkManagement({ onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.csv'))) setFile(f);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleConfirm = () => {
    if (!file) return;
    // TODO: upload file to backend
    onClose();
  };

  return (
    <div className="bulk-overlay" onClick={onClose}>
      <div className="bulk-modal" onClick={e => e.stopPropagation()}>
        <div className="bulk-header">
          <h2>Edit Bulk Shipments</h2>
          <span className="bulk-close" onClick={onClose}>&times;</span>
        </div>

        <div className="bulk-tabs">
          {TABS.map((tab, i) => (
            <div key={tab} className={`bulk-tab${activeTab === i ? ' active' : ''}`} onClick={() => { setActiveTab(i); setFile(null); }}>
              {tab}
            </div>
          ))}
        </div>

        <div className="bulk-body">
          <h3 className="bulk-upload-title">File Upload - Excel/CSV</h3>

          <div
            className={`bulk-dropzone${dragging ? ' dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            {file ? (
              <div className="bulk-file-info">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/>
                </svg>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
                  <rect x="12" y="8" width="40" height="48" rx="4" fill="#f5a623" opacity="0.2"/>
                  <rect x="8" y="12" width="40" height="44" rx="4" fill="#f5a623"/>
                  <circle cx="44" cy="16" r="10" fill="#4361ee"/>
                  <text x="44" y="20" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">1</text>
                </svg>
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--gray-500)' }}>
                  Drag and Drop, or <span style={{ color: '#4361ee', fontWeight: 600, cursor: 'pointer' }}>Browse</span> from your system
                </p>
              </>
            )}
          </div>

          <div className="bulk-info">
            <div className="bulk-info-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              Max. entries allowed : 999
            </div>
            <p>Data in the file should be in correct format. <a href="#" className="bulk-template-link">Download the .xlsx template here.</a></p>
          </div>
        </div>

        <div className="bulk-footer">
          <button className="bulk-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="bulk-btn-confirm" disabled={!file} onClick={handleConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
