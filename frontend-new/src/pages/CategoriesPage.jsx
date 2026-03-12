import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function CategoriesPage() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/categories');
      setCats(r.data.data || r.data.categories || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ name: '', description: '' }); setError(''); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.put(`/api/categories/${editing._id}`, form);
      else await api.post('/api/categories', form);
      setShowModal(false); load();
    } catch (err) { setError(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return;
    try { await api.delete(`/api/categories/${id}`); load(); }
    catch (e) { alert(e.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Categories</h1><p className="page-subtitle">{cats.length} categories</p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Category</button>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {cats.length === 0 ? (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-icon">🏷️</div><p>No categories yet</p></div></td></tr>
                ) : cats.map(c => (
                  <tr key={c._id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.description || '—'}</td>
                    <td><div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c._id)}>🗑️</button>
                    </div></td>
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
              <h3>{editing ? 'Edit Category' : 'Add Category'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group"><label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required /></div>
                <div className="form-group"><label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
