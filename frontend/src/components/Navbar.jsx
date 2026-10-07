import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Package, LayoutDashboard, History, LogOut, Wrench, User,
  Search, ShoppingCart, CheckCircle, Receipt, FileText, PlusCircle,
  CreditCard, Bell, X, Menu, ChevronsLeft, ChevronsRight, Archive, Wallet
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import api from '../services/api';

function Navbar({ user, setUser, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ total: 0, overdue: 0, critical: 0, urgent: 0, warning: 0 });
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const alertPanelRef = useRef(null);

  const role = user?.role || '';

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close alert panel when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (alertPanelRef.current && !alertPanelRef.current.contains(e.target)) {
        setShowAlertPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchAlerts = async () => {
    if (role !== 'manager' && role !== 'cashier') return;
    try {
      const res = await api.get('/credit-alerts');
      setAlerts(res.data.alerts || []);
      setCounts(res.data.counts || { total: 0, overdue: 0, critical: 0, urgent: 0, warning: 0 });
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const badgeCount = counts.overdue + counts.critical + counts.urgent;
  const showBell = role === 'manager' || role === 'cashier';
  const roleLabel = {
    manager: '👑 Manager',
    storekeeper: '📦 Store Keeper',
    frontdesk: '🖥️ Front Desk',
    cashier: '💰 Cashier',
  }[role] || '👤 User';

  // Build nav items by role
  const items = [];
  if (role === 'manager' || role === 'storekeeper') {
    items.push({ to: '/inventory', label: 'Inventory', icon: Package });
  }
  if (role === 'frontdesk') {
    items.push(
      { to: '/frontdesk', label: 'Order Parts', icon: Search },
      { to: '/work-orders', label: 'Work Orders', icon: Wrench },
      { to: '/purchase-requests', label: 'Purchase Requests', icon: PlusCircle }
    );
  }
  if (role === 'cashier') {
    items.push(
      { to: '/cashier', label: 'Part Orders', icon: ShoppingCart },
      { to: '/work-cashier', label: 'Work Payment', icon: Receipt },
      { to: '/purchase-payments', label: 'Purchase Payment', icon: Receipt }
    );
  }
  if (role === 'storekeeper') {
    items.push(
      { to: '/storekeeper', label: 'Issue Items', icon: CheckCircle },
      { to: '/purchase-to-inventory', label: 'Purchase to Inv.', icon: Package }
    );
  }
  if (role === 'manager') {
    items.push(
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/credits', label: 'Credits', icon: CreditCard },
      { to: '/items-sold', label: 'Items Sold', icon: Package },
      { to: '/proformas', label: 'Proforma Invoices', icon: FileText },
      { to: '/old-work-orders', label: 'Old Work Orders', icon: Archive },
      { to: '/history', label: 'Stock History', icon: History },
      { to: '/work-history', label: 'Work History', icon: FileText },
      { to: '/purchase-history', label: 'Purchase History', icon: FileText },
      { to: '/receipt-history', label: 'Receipts', icon: Receipt },
      { to: '/financial', label: 'Financial Status', icon: Wallet }
    );
  }

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* ===== Mobile top bar ===== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 h-14 flex items-center px-4 z-30 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="bg-blue-600 rounded-lg p-1">
            <Wrench className="text-white" size={16} />
          </div>
          <span className="font-bold text-gray-800 text-sm">Mekbeb Denamo</span>
        </div>
      </div>

      {/* ===== Mobile overlay ===== */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 shadow-sm z-50 flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center border-b border-gray-200 h-16 flex-shrink-0 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 rounded-lg p-1.5 flex-shrink-0">
              <Wrench className="text-white" size={20} />
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold text-gray-800 truncate">Mekbeb Denamo</span>
                <span className="text-[10px] text-gray-400 truncate">መክበብ ዲናሞ</span>
              </div>
            )}
          </div>

          {/* Desktop collapse button */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:block p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              title="Collapse sidebar"
            >
              <ChevronsLeft size={16} />
            </button>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="hidden lg:flex mx-auto mt-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Expand sidebar"
          >
            <ChevronsRight size={16} />
          </button>
        )}

        {/* Role pill */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {roleLabel}
            </span>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="space-y-1">
            {items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                    } ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? item.label : ''}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Alerts */}
        {showBell && (
          <div className="px-2 pb-2 relative flex-shrink-0" ref={alertPanelRef}>
            <button
              onClick={() => setShowAlertPanel(!showAlertPanel)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                showAlertPanel
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'
              } ${collapsed ? 'justify-center' : ''}`}
              title="Credit Alerts"
            >
              <div className="relative flex-shrink-0">
                <Bell size={18} />
                {badgeCount > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 ${
                    counts.overdue > 0 ? 'bg-red-600 animate-pulse' : 'bg-orange-500'
                  }`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Alerts</span>
                  {badgeCount > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Alert panel */}
            {showAlertPanel && (
              <div className={`absolute bottom-full mb-2 ${
                collapsed ? 'left-full ml-2' : 'left-2 right-2'
              } w-80 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50`}>
                <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-red-50 border-b flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">Credit Alerts</h3>
                    <p className="text-xs text-gray-500">{counts.total} active</p>
                  </div>
                  <button
                    onClick={() => setShowAlertPanel(false)}
                    className="text-gray-400 hover:text-gray-700 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>

                {counts.total > 0 && (
                  <div className="flex flex-wrap gap-1 px-3 py-2 bg-gray-50 border-b">
                    {counts.overdue > 0 && (
                      <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">
                        {counts.overdue} Overdue
                      </span>
                    )}
                    {counts.critical > 0 && (
                      <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        {counts.critical} Due Now
                      </span>
                    )}
                    {counts.urgent > 0 && (
                      <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        {counts.urgent} Urgent
                      </span>
                    )}
                    {counts.warning > 0 && (
                      <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        {counts.warning} Due Soon
                      </span>
                    )}
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <CheckCircle size={28} className="mx-auto text-green-400 mb-2" />
                      <p className="text-xs text-gray-500">All credits settled</p>
                    </div>
                  ) : (
                    alerts.slice(0, 15).map(alert => {
                      const urgencyColor = {
                        overdue: 'bg-red-50', critical: 'bg-red-50', urgent: 'bg-orange-50',
                        warning: 'bg-yellow-50', normal: 'bg-white'
                      }[alert.urgency] || 'bg-white';
                      const dotColor = {
                        overdue: 'bg-red-600', critical: 'bg-red-500', urgent: 'bg-orange-500',
                        warning: 'bg-yellow-500', normal: 'bg-gray-400'
                      }[alert.urgency] || 'bg-gray-400';
                      const label = {
                        overdue: 'Overdue', critical: 'Due now', urgent: 'Urgent',
                        warning: 'Due soon', normal: 'Active'
                      }[alert.urgency];
                      return (
                        <button
                          key={`${alert.type}-${alert.id}`}
                          onClick={() => {
                            setShowAlertPanel(false);
                            navigate(role === 'manager' ? '/credits' : '/cashier');
                          }}
                          className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 ${urgencyColor} hover:bg-gray-50 transition`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-mono text-[11px] text-blue-600 font-semibold truncate">
                                  {alert.order_number}
                                </span>
                                <span className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded-full font-bold text-gray-600 whitespace-nowrap">
                                  {label}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-gray-800 truncate">
                                {alert.customer_name}
                              </p>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[10px] text-gray-600 font-semibold">
                                  ETB {(parseFloat(alert.total_amount) || 0).toFixed(2)}
                                </span>
                                {alert.days_until_due !== null && (
                                  <span className="text-[10px] text-gray-500">
                                    {alert.days_until_due < 0
                                      ? `${Math.abs(alert.days_until_due)}d overdue`
                                      : alert.days_until_due === 0 ? 'Today'
                                      : `${alert.days_until_due}d`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {alerts.length > 0 && role === 'manager' && (
                  <div className="px-3 py-2 bg-gray-50 border-t text-center">
                    <button
                      onClick={() => { setShowAlertPanel(false); navigate('/credits'); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      View All Credits →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User + Logout */}
        <div className="border-t border-gray-200 p-2 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Logout"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Navbar;