import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth (loaded eagerly since it's the first page)
import Login from './pages/Login';

// All other pages — lazy loaded for resilience
const Inventory = lazy(() => import('./pages/Inventory'));
const FrontDesk = lazy(() => import('./pages/FrontDesk'));
const Cashier = lazy(() => import('./pages/Cashier'));
const StoreKeeper = lazy(() => import('./pages/StoreKeeper'));
const Manager = lazy(() => import('./pages/Manager'));
const History = lazy(() => import('./pages/History'));

const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const WorkHistory = lazy(() => import('./pages/WorkHistory'));

const PurchaseRequests = lazy(() => import('./pages/PurchaseRequests'));
const PurchaseHistory = lazy(() => import('./pages/PurchaseHistory'));
const PurchaseToInventory = lazy(() => import('./pages/PurchaseToInventory'));
const PurchasePayments = lazy(() => import('./pages/PurchasePayments'));

const CreditsHistory = lazy(() => import('./pages/CreditsHistory'));
const ReceiptHistory = lazy(() => import('./pages/ReceiptHistory'));
const ItemSoldHistory = lazy(() => import('./pages/ItemSoldHistory'));
const Receipt = lazy(() => import('./pages/Receipt'));

const ProformaInvoice = lazy(() => import('./pages/ProformaInvoice'));
const ProformaPrint = lazy(() => import('./pages/ProformaPrint'));
const OldWorkOrders = lazy(() => import('./pages/OldWorkOrders'));
const FinancialStatus = lazy(() => import('./pages/FinancialStatus'));

import Navbar from './components/Navbar';
import './index.css';

// ===== Page loading fallback =====
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

// ===== Error Boundary — catches crashes in any page =====
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('💥 Page crashed:', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-700 mb-2">⚠️ This page encountered an error</h2>
            <p className="text-sm text-red-600 mb-3">
              Other pages still work. If this keeps happening, share the error below.
            </p>
            <details className="bg-white border rounded-lg p-3 text-xs">
              <summary className="cursor-pointer font-medium text-gray-700">Show error details</summary>
              <pre className="mt-2 overflow-x-auto text-red-600 whitespace-pre-wrap">
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        setUser(null);
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const role = user?.role || '';

  return (
    <BrowserRouter>
      <Routes>
        {/* ===== Full-page routes (no sidebar) ===== */}
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route
          path="/receipt/:type/:id"
          element={
            user ? (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Receipt />
                </Suspense>
              </ErrorBoundary>
            ) : <Navigate to="/login" />
          }
        />
        <Route
          path="/proforma-print/:id"
          element={
            user ? (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <ProformaPrint />
                </Suspense>
              </ErrorBoundary>
            ) : <Navigate to="/login" />
          }
        />

        {/* ===== App routes (with sidebar) ===== */}
        <Route
          path="/*"
          element={
            user ? (
              <div className="min-h-screen bg-gray-50">
                <Navbar
                  user={user}
                  setUser={setUser}
                  collapsed={collapsed}
                  setCollapsed={setCollapsed}
                />

                <main
                  className={`transition-all duration-300 ease-in-out pt-14 lg:pt-0 ${
                    collapsed ? 'lg:ml-20' : 'lg:ml-64'
                  }`}
                >
                  <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          {/* Default redirect */}
                          <Route
                            path="/"
                            element={
                              role === 'manager' ? <Navigate to="/dashboard" /> :
                              role === 'storekeeper' ? <Navigate to="/inventory" /> :
                              role === 'frontdesk' ? <Navigate to="/frontdesk" /> :
                              role === 'cashier' ? <Navigate to="/cashier" /> :
                              <Navigate to="/login" />
                            }
                          />

                          {/* Inventory */}
                          <Route path="/inventory" element={
                            (role === 'manager' || role === 'storekeeper') ? <Inventory /> : <Navigate to="/" />
                          } />
                          <Route path="/frontdesk" element={
                            role === 'frontdesk' ? <FrontDesk /> : <Navigate to="/" />
                          } />
                          <Route path="/cashier" element={
                            role === 'cashier' ? <Cashier /> : <Navigate to="/" />
                          } />
                          <Route path="/storekeeper" element={
                            role === 'storekeeper' ? <StoreKeeper /> : <Navigate to="/" />
                          } />
                          <Route path="/dashboard" element={
                            role === 'manager' ? <Manager /> : <Navigate to="/" />
                          } />
                          <Route path="/history" element={
                            role === 'manager' ? <History /> : <Navigate to="/" />
                          } />

                          {/* Work Orders */}
                          <Route path="/work-orders" element={
                            role === 'frontdesk' ? <WorkOrders /> : <Navigate to="/" />
                          } />
                          <Route path="/work-history" element={
                            role === 'manager' ? <WorkHistory /> : <Navigate to="/" />
                          } />

                          {/* Purchase */}
                          <Route path="/purchase-requests" element={
                            role === 'frontdesk' ? <PurchaseRequests /> : <Navigate to="/" />
                          } />
                          <Route path="/purchase-payments" element={
                            role === 'cashier' ? <PurchasePayments /> : <Navigate to="/" />
                          } />
                          <Route path="/purchase-to-inventory" element={
                            role === 'storekeeper' ? <PurchaseToInventory /> : <Navigate to="/" />
                          } />
                          <Route path="/purchase-history" element={
                            role === 'manager' ? <PurchaseHistory /> : <Navigate to="/" />
                          } />

                          {/* Credits & Receipts */}
                          <Route path="/credits" element={
                            role === 'manager' ? <CreditsHistory /> : <Navigate to="/" />
                          } />
                          <Route path="/receipt-history" element={
                            role === 'manager' ? <ReceiptHistory /> : <Navigate to="/" />
                          } />
                          <Route path="/items-sold" element={
                            role === 'manager' ? <ItemSoldHistory /> : <Navigate to="/" />
                          } />

                          {/* Proforma & Archive */}
                          <Route path="/proformas" element={
                            role === 'manager' ? <ProformaInvoice /> : <Navigate to="/" />
                          } />
                          <Route path="/old-work-orders" element={
                            role === 'manager' ? <OldWorkOrders /> : <Navigate to="/" />
                          } />
                          <Route path="/financial" element={
                            role === 'manager' ? <FinancialStatus /> : <Navigate to="/" />
                          } />

                          <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                </main>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;