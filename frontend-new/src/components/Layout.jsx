import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '📊', to: '/', exact: true },
  { label: 'Bills', icon: '🧾', to: '/bills' },
  { label: 'Sales Entries', icon: '📈', to: '/sales-entries' },
  { label: 'Purchase Entries', icon: '📦', to: '/purchase-entries' },
  { label: 'Products', icon: '👕', to: '/products' },
  { label: 'Inventory', icon: '📋', to: '/inventory' },
  { label: 'Categories', icon: '🏷️', to: '/categories' },
  { label: 'Customers', icon: '👤', to: '/customers' },
  { label: 'Suppliers', icon: '🏭', to: '/suppliers' },
  { label: 'Reports', icon: '📄', to: '/reports' },
  { label: 'Settings', icon: '⚙️', to: '/settings' },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/bills': 'Bills',
  '/sales-entries': 'Sales Entries',
  '/purchase-entries': 'Purchase Entries',
  '/products': 'Products',
  '/inventory': 'Inventory',
  '/categories': 'Categories',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = PAGE_TITLES[location.pathname] || 'Sri Ram Fashions';
  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>👔 Sri Ram</h2>
          <p>Fashions</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ label, icon, to, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="app-main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-title">{pageTitle}</div>
          <div className="topbar-user">
            <div className="topbar-avatar">{initials}</div>
            <div>
              <div className="topbar-user-name">{user?.name}</div>
              <div className="topbar-user-role">{user?.role}</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
