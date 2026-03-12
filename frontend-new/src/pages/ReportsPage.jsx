import React, { useState } from 'react';
import api from '../services/api.js';

const REPORT_TYPES = [
  { value: 'sales', label: '📊 Sales Report' },
  { value: 'purchase', label: '📦 Purchase Report' },
  { value: 'stock', label: '📋 Stock Report' },
  { value: 'auditor-sales', label: '🔍 Auditor Sales' },
  { value: 'auditor-purchase', label: '🔍 Auditor Purchase' },
];

export default function ReportsPage() {
  const [type, setType] = useState('sales');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const fetchReport = async () => {
    setLoading(true); setError(''); setData([]); setMsg('');
    try {
      const endpoints = {
        sales: '/api/reports/sales-report',
        purchase: '/api/reports/purchase-report',
        stock: '/api/reports/stock-report',
        'auditor-sales': '/api/reports/auditor-sales',
        'auditor-purchase': '/api/reports/auditor-purchase',
      };
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const r = await api.get(endpoints[type], { params });
      setData(r.data.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed to load report'); }
    finally { setLoading(false); }
  };

  const sendEmail = async () => {
    setEmailing(true); setMsg(''); setError('');
    try {
      const r = await api.post('/api/email/send-report', { type, fromDate, toDate, data });
      setMsg(r.data.message || 'Report emailed!');
    } catch (e) { setError(e.response?.data?.message || 'Failed to send email'); }
    finally { setEmailing(false); }
  };

  const sendSummary = async () => {
    setEmailing(true); setMsg(''); setError('');
    try {
      const r = await api.post('/api/email/daily-summary');
      setMsg(r.data.message || 'Daily summary sent!');
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setEmailing(false); }
  };

  const allColumns = data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_id') : [];
  const fmtVal = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return v.toLocaleString('en-IN');
    if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(v).toLocaleDateString('en-IN');
    return String(v);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Generate and email business reports</p></div>
        <button className="btn btn-secondary" onClick={sendSummary} disabled={emailing}>
          {emailing ? '⏳' : '📧'} Daily Summary
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
            <label className="form-label">Report Type</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input className="form-input" type="date" value={fromDate} max={today} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input className="form-input" type="date" value={toDate} max={today} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? '⏳ Loading…' : '📊 Generate Report'}
          </button>
          {data.length > 0 && (
            <button className="btn btn-success" onClick={sendEmail} disabled={emailing}>
              {emailing ? '⏳' : '📧'} Email Report
            </button>
          )}
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : data.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <strong>{REPORT_TYPES.find(t => t.value === type)?.label}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{data.length} records</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>{allColumns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {allColumns.map(c => <td key={c}>{fmtVal(row[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No Report Generated</h3>
            <p>Select a report type and click "Generate Report"</p>
          </div>
        </div>
      )}
    </div>
  );
}
