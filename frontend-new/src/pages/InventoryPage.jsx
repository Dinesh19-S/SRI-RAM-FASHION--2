import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [adjForm, setAdjForm] = useState({ quantity: '', type: 'add', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/products');
      setItems(r.data.data || r.data.products || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdj = (p) => { setSelected(p); setAdjForm({ quantity:'', type:'add', reason:'' }); setShowModal(true); };

  const handleAdjust = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/api/inventory/${selected._id}/adjust`, adjForm);
      setShowModal(false); load();
    } catch (e) { alert(e.response?.data?.message || 'Adjustment failed'); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">Manage stock levels</p></div>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Current Stock</th><th>Min Stock</th><th>Status</th><th>Adjust</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📋</div><p>No products</p></div></td></tr>
                ) : filtered.map(p => (
                  <tr key={p._id}>
                    <td><strong>{p.name}</strong></td>
                    <td><code style={{ fontSize: 11 }}>{p.sku}</code></td>
                    <td>{p.category?.name || '—'}</td>
                    <td style={{ fontWeight: 700, fontSize: 16 }}>{p.stock}</td>
                    <td>{p.lowStockThreshold}</td>
                    <td>
                      <span className={`badge ${p.stock <= 0 ? 'badge-red' : p.stock <= p.lowStockThreshold ? 'badge-yellow' : 'badge-green'}`}>
                        {p.stock <= 0 ? 'Out of Stock' : p.stock <= p.lowStockThreshold ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openAdj(p)}>⚖️ Adjust</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showModal && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Adjust Stock — {selected.name}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdjust}>
              <div className="modal-body">
                <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  Current Stock: <strong>{selected.stock}</strong>
                </div>
                <div className="form-group">
                  <label className="form-label">Adjustment Type</label>
                  <select className="form-select" value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="add">➕ Add Stock</option>
                    <option value="remove">➖ Remove Stock</option>
                    <option value="set">🔄 Set to Value</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="0" required value={adjForm.quantity} onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <input className="form-input" placeholder="e.g. Received shipment" value={adjForm.reason} onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Adjust Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
