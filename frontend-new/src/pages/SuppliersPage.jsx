import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

export default function SuppliersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(empty());

  function empty() { return { name:'', phone:'', email:'', address:'', gstin:'', contactPerson:'' }; }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/suppliers');
      setItems(r.data.data || r.data.suppliers || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const openAdd = () => { setEditing(null); setForm(empty()); setError(''); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({name:c.name||'',phone:c.phone||'',email:c.email||'',address:c.address||'',gstin:c.gstin||'',contactPerson:c.contactPerson||''}); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.put(`/api/suppliers/${editing._id}`, form);
      else await api.post('/api/suppliers', form);
      setShowModal(false); load();
    } catch (err) { setError(err.response?.data?.message||'Save failed'); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    try { await api.delete(`/api/suppliers/${id}`); load(); }
    catch (e) { alert(e.response?.data?.message||'Delete failed'); }
  };

  const s = (k,v) => setForm(p=>({...p,[k]:v}));
  const filtered = items.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Suppliers</h1><p className="page-subtitle">{items.length} suppliers</p></div>
        <div style={{display:'flex',gap:12}}>
          <div className="search-bar"><span className="search-icon">🔍</span>
            <input className="form-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:36}} /></div>
          <button className="btn btn-primary" onClick={openAdd}>➕ Add Supplier</button>
        </div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner"/></div> : (
        <div className="card" style={{padding:0}}>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>GSTIN</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length===0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">🏭</div><p>No suppliers</p></div></td></tr>
                ) : filtered.map(c=>(
                  <tr key={c._id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.contactPerson||'—'}</td>
                    <td>{c.phone||'—'}</td>
                    <td>{c.email||'—'}</td>
                    <td><code style={{fontSize:11}}>{c.gstin||'—'}</code></td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(c)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(c._id)}>🗑️</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editing?'Edit Supplier':'Add Supplier'}</h3>
              <button className="modal-close" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Company Name *</label><input className="form-input" value={form.name} onChange={e=>s('name',e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Contact Person</label><input className="form-input" value={form.contactPerson} onChange={e=>s('contactPerson',e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e=>s('phone',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e=>s('email',e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">GSTIN</label><input className="form-input" value={form.gstin} onChange={e=>s('gstin',e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={form.address} onChange={e=>s('address',e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
