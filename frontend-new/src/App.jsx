import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import BillsPage from './pages/BillsPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import PurchaseEntriesPage from './pages/PurchaseEntriesPage.jsx';
import SalesEntriesPage from './pages/SalesEntriesPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="bills" element={<BillsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="purchase-entries" element={<PurchaseEntriesPage />} />
            <Route path="sales-entries" element={<SalesEntriesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
