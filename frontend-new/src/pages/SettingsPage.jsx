import React, { useState, useEffect } from 'react';
import api from '../services/api.js';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);

  useEffect(() => {
    fetchSettings();
    checkEmailStatus();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/settings');
      setSettings(r.data.data || r.data.settings || {});
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const checkEmailStatus = async () => {
    try {
      const r = await api.get('/api/email/status');
      setEmailStatus(r.data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.put('/api/settings', settings);
      setMsg('Settings saved successfully!');
    } catch (err) { setMsg('Failed to save: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const sendTestEmail = async () => {
    try {
      const r = await api.post('/api/email/test');
      setMsg(r.data.message || 'Test email sent!');
    } catch (e) { setMsg(e.response?.data?.message || 'Failed to send test email'); }
  };

  const s = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Application configuration</p></div>
      </div>

      {msg && <div className={`alert ${msg.includes('Failed') || msg.includes('fail') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Business Info */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">🏪 Business Information</h3></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Business Name</label>
                <input className="form-input" value={settings.businessName || ''} onChange={e => s('businessName', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label>
                <input className="form-input" value={settings.phone || ''} onChange={e => s('phone', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label>
                <input className="form-input" type="email" value={settings.email || ''} onChange={e => s('email', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">GSTIN</label>
                <input className="form-input" value={settings.gstin || ''} onChange={e => s('gstin', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Address</label>
              <textarea className="form-textarea" value={settings.address || ''} onChange={e => s('address', e.target.value)} /></div>
          </div>

          {/* Invoice Settings */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">🧾 Invoice Settings</h3></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Invoice Prefix</label>
                <input className="form-input" placeholder="e.g. SRF" value={settings.invoicePrefix || ''} onChange={e => s('invoicePrefix', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Next Invoice Number</label>
                <input className="form-input" type="number" value={settings.nextInvoiceNumber || ''} onChange={e => s('nextInvoiceNumber', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Default GST Rate (%)</label>
                <select className="form-select" value={settings.defaultGstRate || '12'} onChange={e => s('defaultGstRate', e.target.value)}>
                  {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Default Payment Method</label>
                <select className="form-select" value={settings.defaultPaymentMethod || 'cash'} onChange={e => s('defaultPaymentMethod', e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                </select></div>
            </div>
          </div>

          {/* Email Status */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">📧 Email Configuration</h3></div>
            {emailStatus ? (
              <div style={{ marginBottom: 16 }}>
                <div className={`alert ${emailStatus.configured ? 'alert-success' : 'alert-warning'}`}>
                  {emailStatus.configured
                    ? `✅ Email configured via ${emailStatus.provider?.toUpperCase()} — Default recipient: ${emailStatus.defaultRecipient}`
                    : '⚠️ Email not configured. Set RESEND_API_KEY or EMAIL_USER + EMAIL_PASS in backend/.env'}
                </div>
                {emailStatus.configured && (
                  <button type="button" className="btn btn-secondary" onClick={sendTestEmail}>📧 Send Test Email</button>
                )}
              </div>
            ) : <div className="alert alert-info">Checking email status…</div>}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ Saving…' : '💾 Save Settings'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={fetchSettings}>↩️ Reset</button>
          </div>
        </div>
      </form>
    </div>
  );
}
