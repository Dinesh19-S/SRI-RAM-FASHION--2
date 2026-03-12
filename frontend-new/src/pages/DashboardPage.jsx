import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import api from '../services/api.js';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, billsRes, stockRes, chartRes] = await Promise.allSettled([
        api.get('/api/dashboard/overview'),
        api.get('/api/dashboard/recent-bills?limit=5'),
        api.get('/api/dashboard/low-stock-alerts?limit=5'),
        api.get('/api/dashboard/revenue-chart?days=7'),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data);
      if (billsRes.status === 'fulfilled') setRecentBills(billsRes.value.data.data || []);
      if (stockRes.status === 'fulfilled') setLowStock(stockRes.value.data.data || []);
      if (chartRes.status === 'fulfilled') setChartData(chartRes.value.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
  const fmtMoney = (n) => `₹${fmt(n)}`;

  if (loading) return (
    <div className="loading-center"><div className="spinner" /><span>Loading dashboard…</span></div>
  );

  const statCards = [
    { label: "Today's Revenue", value: fmtMoney(stats?.todayRevenue), icon: '💰', color: '#059669', bg: '#dcfce7' },
    { label: 'Total Bills', value: fmt(stats?.totalBills), icon: '🧾', color: '#2563eb', bg: '#dbeafe' },
    { label: 'Products', value: fmt(stats?.totalProducts), icon: '👕', color: '#7c3aed', bg: '#f3e8ff' },
    { label: 'Low Stock Items', value: fmt(stats?.lowStockCount), icon: '⚠️', color: '#dc2626', bg: '#fee2e2' },
    { label: 'Total Customers', value: fmt(stats?.totalCustomers), icon: '👤', color: '#0891b2', bg: '#cffafe' },
    { label: "Month's Revenue", value: fmtMoney(stats?.monthRevenue), icon: '📈', color: '#d97706', bg: '#fef9c3' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's your business overview.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchAll}>🔄 Refresh</button>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        {statCards.map(({ label, value, icon, color, bg }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon" style={{ background: bg, color }}>
              {icon}
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color }}>{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Low Stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 24 }}>
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📈 Revenue (Last 7 Days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e40af" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#1e40af" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">⚠️ Low Stock Alerts</h3>
          </div>
          {lowStock.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 16px' }}>
              <div className="empty-icon">✅</div>
              <p>All products are well-stocked</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lowStock.map(p => (
                <div key={p._id} style={stockItemStyle}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Min: {p.lowStockThreshold}</div>
                  </div>
                  <span className={`badge ${p.stock <= 0 ? 'badge-red' : 'badge-yellow'}`}>
                    {p.stock <= 0 ? 'OUT' : p.stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🧾 Recent Bills</h3>
        </div>
        {recentBills.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div><p>No bills yet</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Bill #</th><th>Customer</th><th>Date</th>
                  <th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBills.map(b => (
                  <tr key={b._id}>
                    <td><strong>{b.billNumber}</strong></td>
                    <td>{b.customer?.name || '—'}</td>
                    <td>{b.date ? new Date(b.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td><strong>₹{(b.grandTotal || 0).toLocaleString('en-IN')}</strong></td>
                    <td>
                      <span className={`badge ${b.paymentStatus === 'paid' ? 'badge-green' : b.paymentStatus === 'pending' ? 'badge-yellow' : 'badge-red'}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const stockItemStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  background: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: 8,
};
