import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [emailingId, setEmailingId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.paymentStatus = filter;
      const r = await api.get('/api/bills', { params });
      setBills(r.data.data || r.data.bills || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleEmailBill = async (billId) => {
    setEmailingId(billId); setMsg('');
    try {
      const r = await api.post(`/api/email/send-bill/${billId}`);
      setMsg(r.data.message || 'Email sent!');
    } catch (e) { setMsg(e.response?.data?.message || 'Failed to send email'); }
    finally { setEmailingId(null); }
  };

  const fmt = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;
  const filtered = bills.filter(b =>
    b.billNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Bills</h1><p className="page-subtitle">{bills.length} bills</p></div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search bills…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="cancel">Cancelled</option>
          </select>
        </div>
      </div>

      {msg && <div className={`alert ${msg.includes('Failed')||msg.includes('fail') ? 'alert-error':'alert-success'}`}>{msg}</div>}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Bill #</th><th>Type</th><th>Customer</th><th>Date</th>
                <th>Items</th><th>Grand Total</th><th>Payment</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">🧾</div><p>No bills found</p></div></td></tr>
                ) : filtered.map(b => (
                  <tr key={b._id}>
                    <td><strong>{b.billNumber}</strong></td>
                    <td><span className={`badge ${b.billType==='SALES'?'badge-blue':'badge-purple'}`}>{b.billType||'SALES'}</span></td>
                    <td>{b.customer?.name||'Walk-in'}</td>
                    <td>{b.date ? new Date(b.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{b.items?.length||0}</td>
                    <td><strong>{fmt(b.grandTotal)}</strong></td>
                    <td>{b.paymentMethod}</td>
                    <td>
                      <span className={`badge ${b.paymentStatus==='paid'?'badge-green':b.paymentStatus==='pending'?'badge-yellow':b.paymentStatus==='cancel'?'badge-red':'badge-gray'}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" title="Email bill"
                        onClick={() => handleEmailBill(b._id)}
                        disabled={emailingId === b._id}>
                        {emailingId === b._id ? '⏳' : '📧'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
