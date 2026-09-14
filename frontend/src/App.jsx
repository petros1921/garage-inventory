import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import Login from './pages/Login';

// Inventory System
import Inventory from './pages/Inventory';
import FrontDesk from './pages/FrontDesk';
import Cashier from './pages/Cashier';
import StoreKeeper from './pages/StoreKeeper';
import Manager from './pages/Manager';
import History from './pages/History';

// Work Order System
import WorkOrders from './pages/WorkOrders';
import WorkHistory from './pages/WorkHistory';

// Purchase Order System
import PurchaseRequests from './pages/PurchaseRequests';
import PurchaseHistory from './pages/PurchaseHistory';
import PurchaseToInventory from './pages/PurchaseToInventory';
import PurchasePayments from './pages/PurchasePayments';

import Navbar from './components/Navbar';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const role = user?.role || '';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/*" element={
          user ? (
            <div className="min-h-screen bg-gray-50">
              <Navbar user={user} setUser={setUser} />
              <div className="container mx-auto max-w-7xl px-4 py-4">
                <Routes>
                  {/* ===== DEFAULT REDIRECT ===== */}
                  <Route path="/" element={
                    role === 'manager' ? <Navigate to="/dashboard" /> :
                    role === 'storekeeper' ? <Navigate to="/inventory" /> :
                    role === 'frontdesk' ? <Navigate to="/frontdesk" /> :
                    role === 'cashier' ? <Navigate to="/cashier" /> :
                    <Navigate to="/login" />
                  } />

                  {/* ===== INVENTORY SYSTEM ===== */}
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

                  {/* ===== WORK ORDER SYSTEM ===== */}
                  <Route path="/work-orders" element={
                    role === 'frontdesk' ? <WorkOrders /> : <Navigate to="/" />
                  } />
                  <Route path="/work-history" element={
                    role === 'manager' ? <WorkHistory /> : <Navigate to="/" />
                  } />

                  {/* ===== PURCHASE ORDER SYSTEM ===== */}
                  {/* Front Desk - Create purchase requests */}
                  <Route path="/purchase-requests" element={
                    role === 'frontdesk' ? <PurchaseRequests /> : <Navigate to="/" />
                  } />
                  {/* Cashier - Pay purchase orders from petty cash */}
                  <Route path="/purchase-payments" element={
                    role === 'cashier' ? <PurchasePayments /> : <Navigate to="/" />
                  } />
                  {/* Store Keeper - Add purchased items to inventory */}
                  <Route path="/purchase-to-inventory" element={
                    role === 'storekeeper' ? <PurchaseToInventory /> : <Navigate to="/" />
                  } />
                  {/* Manager - View purchase history */}
                  <Route path="/purchase-history" element={
                    role === 'manager' ? <PurchaseHistory /> : <Navigate to="/" />
                  } />

                  {/* ===== CATCH-ALL ===== */}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </div>
            </div>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;