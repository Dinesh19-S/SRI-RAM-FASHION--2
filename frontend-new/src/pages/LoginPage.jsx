import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.success) navigate('/');
      else setError(data.message || 'Login failed');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await register(form.name, form.email, form.password, form.phone);
      if (data.success) navigate('/');
      else setError(data.message || 'Registration failed');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const api = (await import('../services/api.js')).default;
      const { data } = await api.post('/auth/forgot-password', { email: form.email });
      setSuccess(data.message || 'Reset code sent to your email');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>👔</div>
          <h1 style={styles.brandTitle}>Sri Ram Fashions</h1>
          <p style={styles.brandSub}>Business Management System</p>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {['login', 'register'].map(t => (
            <button key={t} style={{ ...styles.tab, ...(mode === t ? styles.tabActive : {}) }}
              onClick={() => { setMode(t); setError(''); setSuccess(''); }}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="admin@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
              type="submit" disabled={loading}>
              {loading ? '⏳ Signing in…' : '🔑 Sign In'}
            </button>
            <button type="button" style={styles.forgotBtn}
              onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}>
              Forgot password?
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Your Name"
                value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" placeholder="9xxxxxxxxx"
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              type="submit" disabled={loading}>
              {loading ? '⏳ Registering…' : '✅ Create Account'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Enter your email and we'll send a 6-digit reset code.
            </p>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
              type="submit" disabled={loading}>
              {loading ? '⏳ Sending…' : '📧 Send Reset Code'}
            </button>
            <button type="button" style={styles.forgotBtn}
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
              ← Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: 36,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  brand: { textAlign: 'center', marginBottom: 28 },
  brandIcon: {
    fontSize: 48,
    lineHeight: 1,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  brandSub: { fontSize: 11, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  tabs: {
    display: 'flex',
    background: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    border: 'none',
    background: 'transparent',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: '#64748b',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#fff',
    color: '#1e40af',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: 13,
    width: '100%',
    textAlign: 'center',
    padding: '4px 0',
  },
};
