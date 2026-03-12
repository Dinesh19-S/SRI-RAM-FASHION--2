import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function PurchaseEntriesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/purchase-entries');
      setItems(r.data.data || r.data.entries || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(e =>
    e.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    e.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Purchase Entries</h1><p className="page-subtitle">{items.length} entries</p></div>
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
                <th>Invoice #</th><th>Supplier</th><th>Date</th>
                <th>Items</th><th>Grand Total</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">📦</div><p>No purchase entries</p></div></td></tr>
                ) : filtered.map(e => (
                  <tr key={e._id}>
                    <td><strong>{e.invoiceNumber}</strong></td>
                    <td>{e.supplier?.name || e.supplierName || '—'}</td>
                    <td>{e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{e.items?.length || 0}</td>
                    <td><strong>₹{(e.grandTotal || 0).toLocaleString('en-IN')}</strong></td>
                    <td><span className={`badge ${e.status === 'completed' ? 'badge-green' : e.status === 'cancelled' ? 'badge-red' : 'badge-gray'}`}>{e.status || 'completed'}</span></td>
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
