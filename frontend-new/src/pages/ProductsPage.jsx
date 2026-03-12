import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return { name: '', sku: '', description: '', category: '', mrp: '', sellingPrice: '', stock: '0', lowStockThreshold: '5', unit: 'pcs', size: '', hsn: '', gstRate: '12' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/categories'),
      ]);
      setProducts(pRes.data.data || pRes.data.products || []);
      setCategories(cRes.data.data || cRes.data.categories || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setError(''); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, category: p.category?._id || p.category || '' });
    setError(''); setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) {
        await api.put(`/api/products/${editing._id}`, form);
      } else {
        await api.post('/api/products', form);
      }
      setShowModal(false); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    try { await api.delete(`/api/products/${id}`); load(); }
    catch (e) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Products</h1><p className="page-subtitle">{products.length} products</p></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <button className="btn btn-primary" onClick={openAdd}>➕ Add Product</button>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Name</th><th>SKU</th><th>Category</th><th>MRP</th>
                <th>Sale Price</th><th>Stock</th><th>GST %</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">👕</div><p>No products found</p></div></td></tr>
                ) : filtered.map(p => (
                  <tr key={p._id}>
                    <td><strong>{p.name}</strong>{p.size && <span style={{ color: '#64748b', fontSize: 11 }}> — {p.size}</span>}</td>
                    <td><code style={{ fontSize: 11 }}>{p.sku}</code></td>
                    <td>{p.category?.name || '—'}</td>
                    <td>₹{(p.mrp || 0).toLocaleString('en-IN')}</td>
                    <td>₹{(p.sellingPrice || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`badge ${p.stock <= 0 ? 'badge-red' : p.stock <= p.lowStockThreshold ? 'badge-yellow' : 'badge-green'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td>{p.gstRate}%</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p._id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editing ? 'Edit Product' : 'Add Product'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Name *</label>
                    <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">SKU *</label>
                    <input className="form-input" value={form.sku} onChange={e => set('sku', e.target.value)} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Category *</label>
                    <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)} required>
                      <option value="">Select…</option>
                      {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Size</label>
                    <input className="form-input" value={form.size} onChange={e => set('size', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">MRP *</label>
                    <input className="form-input" type="number" value={form.mrp} onChange={e => set('mrp', e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Selling Price *</label>
                    <input className="form-input" type="number" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Stock</label>
                    <input className="form-input" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Low Stock Alert</label>
                    <input className="form-input" type="number" value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">HSN Code</label>
                    <input className="form-input" value={form.hsn} onChange={e => set('hsn', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">GST Rate %</label>
                    <select className="form-select" value={form.gstRate} onChange={e => set('gstRate', e.target.value)}>
                      {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
