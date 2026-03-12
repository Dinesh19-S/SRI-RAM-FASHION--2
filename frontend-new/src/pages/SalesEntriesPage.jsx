import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function SalesEntriesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/sales-entries');
      setItems(r.data.data || r.data.entries || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEmail = async (id) => {
    try {
      const r = await api.post(`/api/email/send-bill/${id}`);
      alert(r.data.message || 'Email sent!');
    } catch (e) { alert(e.response?.data?.message || 'Failed'); }
  };

  const filtered = items.filter(e =>
    e.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    e.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Sales Entries</h1><p className="page-subtitle">{items.length} entries</p></div>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Invoice #</th><th>Customer</th><th>Date</th>
                <th>Items</th><th>Grand Total</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📈</div><p>No sales entries</p></div></td></tr>
                ) : filtered.map(e => (
                  <tr key={e._id}>
                    <td><strong>{e.invoiceNumber}</strong></td>
                    <td>{e.customer?.name || '—'}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{e.customer?.mobile}</span></td>
                    <td>{e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{e.items?.length || 0}</td>
                    <td><strong>₹{(e.grandTotal || 0).toLocaleString('en-IN')}</strong></td>
                    <td><span className={`badge ${e.status === 'completed' ? 'badge-green' : e.status === 'cancelled' ? 'badge-red' : 'badge-gray'}`}>{e.status}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEmail(e._id)} title="Email invoice">📧</button>
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
