import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, ClipboardList, LayoutDashboard, History, LogOut, Wrench, User,
  Search, ShoppingCart, CheckCircle, Receipt, FileText, PlusCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

function Navbar({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const role = user?.role || '';

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between flex-wrap gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Wrench className="text-blue-600" size={24} />
          <span className="font-bold text-lg text-gray-800">Garage</span>
          <span className="text-xs text-gray-400 hidden sm:inline-block ml-2">
            {role === 'manager' ? '👑 Manager' :
             role === 'storekeeper' ? '📦 Store Keeper' :
             role === 'frontdesk' ? '🖥️ Front Desk' :
             role === 'cashier' ? '💰 Cashier' : '👤 User'}
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Inventory - Store Keeper & Manager */}
          {(role === 'manager' || role === 'storekeeper') && (
            <Link to="/inventory" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
              <Package size={18} />
              <span className="hidden sm:inline">Inventory</span>
            </Link>
          )}

          {/* Front Desk - Order Parts & Work Orders & Purchase Requests */}
          {role === 'frontdesk' && (
            <>
              <Link to="/frontdesk" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <Search size={18} />
                <span className="hidden sm:inline">Order Parts</span>
              </Link>
              <Link to="/work-orders" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <Wrench size={18} />
                <span className="hidden sm:inline">Work Orders</span>
              </Link>
              <Link to="/purchase-requests" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <PlusCircle size={18} />
                <span className="hidden sm:inline">Purchase Requests</span>
              </Link>
            </>
          )}

          {/* Cashier - Part Orders, Work Payment, Purchase Payments */}
          {role === 'cashier' && (
            <>
              <Link to="/cashier" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <ShoppingCart size={18} />
                <span className="hidden sm:inline">Part Orders</span>
              </Link>
              <Link to="/work-cashier" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <Receipt size={18} />
                <span className="hidden sm:inline">Work Payment</span>
              </Link>
              <Link to="/purchase-payments" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <Receipt size={18} />
                <span className="hidden sm:inline">Purchase Payment</span>
              </Link>
            </>
          )}

          {/* Store Keeper - Issue Items & Purchase to Inventory */}
          {role === 'storekeeper' && (
            <>
              <Link to="/storekeeper" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <CheckCircle size={18} />
                <span className="hidden sm:inline">Issue Items</span>
              </Link>
              <Link to="/purchase-to-inventory" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <Package size={18} />
                <span className="hidden sm:inline">Purchase to Inv.</span>
              </Link>
            </>
          )}

          {/* Manager */}
          {role === 'manager' && (
            <>
              <Link to="/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link to="/history" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <History size={18} />
                <span className="hidden sm:inline">Stock History</span>
              </Link>
              <Link to="/work-history" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <FileText size={18} />
                <span className="hidden sm:inline">Work History</span>
              </Link>
              <Link to="/purchase-history" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-2 py-2 rounded-lg hover:bg-blue-50 text-sm">
                <FileText size={18} />
                <span className="hidden sm:inline">Purchase History</span>
              </Link>
            </>
          )}

          {/* User Name */}
          <div className="hidden sm:flex items-center gap-2 ml-2 border-l border-gray-200 pl-2">
            <User size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">{user?.full_name || 'User'}</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 px-2 py-2 rounded-lg hover:bg-red-50 text-sm"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;