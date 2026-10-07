import React, { useState, useEffect } from 'react';
import {
  Package, AlertTriangle, Clock, CheckCircle,
  DollarSign, ShoppingCart, Box, TrendingUp, X, PlusCircle,
  Wallet, CreditCard, Bell, Eye, ArrowRight, Wrench
} from 'lucide-react';
import api from '../services/api';
import EthiopianDate from '../components/EthiopianDate';

const urgencyColor = (urgency) => ({
  overdue:  'bg-red-100 text-red-700 border-red-300',
  critical: 'bg-red-50 text-red-600 border-red-200',
  urgent:   'bg-orange-50 text-orange-700 border-orange-200',
  warning:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  normal:   'bg-gray-50 text-gray-700 border-gray-200',
}[urgency] || 'bg-gray-50 text-gray-700 border-gray-200');

function Manager() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    total_parts: 0, total_quantity: 0, total_new_quantity: 0, total_used_quantity: 0,
    pending_manager_orders: 0, low_stock_items: [], low_stock_count: 0,
    no_selling_price_items: [], total_orders: 0, completed_orders: 0,
  });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingWorkOrders, setPendingWorkOrders] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [pendingManagerPayments, setPendingManagerPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState('purchases');

  const [pettyCash, setPettyCash] = useState({ balance: 0, allocated: 0, deducted: 0 });

  const [creditCounts, setCreditCounts] = useState({ total: 0, overdue: 0, critical: 0, urgent: 0, warning: 0 });
  const [creditAlerts, setCreditAlerts] = useState([]);
  const [totalOwed, setTotalOwed] = useState(0);

  const [selectedPartOrder, setSelectedPartOrder] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  const [showSetPriceModal, setShowSetPriceModal] = useState(false);
  const [setPricePartId, setSetPricePartId] = useState(null);
  const [setPriceItemName, setSetPriceItemName] = useState('');
  const [setPriceValue, setSetPriceValue] = useState(0);
  const [showPettyCashModal, setShowPettyCashModal] = useState(false);
  const [pettyCashAmount, setPettyCashAmount] = useState('');
  const [pettyCashWeekStart, setPettyCashWeekStart] = useState('');
  const [pettyCashWeekEnd, setPettyCashWeekEnd] = useState('');
  const [showManagerPaymentModal, setShowManagerPaymentModal] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [otherPaymentMethod, setOtherPaymentMethod] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAlert, setSettleAlert] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settling, setSettling] = useState(false);

  const openNotification = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
  };
  const closeNotification = () => setShowNotification(false);

  const openConfirmModal = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };
  const handleConfirm = async () => {
    if (confirmAction) await confirmAction();
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const handleSetPriceSubmit = async () => {
    if (!setPricePartId || isNaN(setPriceValue) || setPriceValue < 0) {
      openNotification('Please enter a valid price', 'error');
      return;
    }
    try {
      await api.put(`/parts/${setPricePartId}/set-selling-price`, { selling_price: parseFloat(setPriceValue) });
      openNotification('✅ Selling price updated!', 'success');
      setShowSetPriceModal(false);
      setSetPricePartId(null);
      fetchData();
    } catch (err) {
      openNotification('❌ ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleSetPettyCash = async () => {
    if (!pettyCashAmount || parseFloat(pettyCashAmount) <= 0) {
      openNotification('Enter a valid amount', 'error');
      return;
    }
    if (!pettyCashWeekStart || !pettyCashWeekEnd) {
      openNotification('Select week range', 'error');
      return;
    }
    try {
      await api.post('/petty-cash/allocate', {
        amount: parseFloat(pettyCashAmount),
        week_start: pettyCashWeekStart,
        week_end: pettyCashWeekEnd,
        created_by: user?.id,
      });
      openNotification('✅ Petty cash allocated!', 'success');
      setShowPettyCashModal(false);
      setPettyCashAmount('');
      setPettyCashWeekStart('');
      setPettyCashWeekEnd('');
      fetchData();
    } catch (err) {
      openNotification('❌ ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleSubmitManagerPayment = async () => {
    if (!paymentMethod) return openNotification('Select a payment method', 'error');
    if (paymentMethod === 'Other' && !otherPaymentMethod.trim()) return openNotification('Specify the method', 'error');
    if (!receiptNumber.trim()) return openNotification('Enter receipt number', 'error');

    setSubmittingPayment(true);
    try {
      const res = await api.put(`/purchase-orders/${selectedPurchaseForPayment.id}/pay-manager`, {
        payment_method: paymentMethod === 'Other' ? otherPaymentMethod.trim() : paymentMethod,
        receipt_no: receiptNumber.trim(),
        paid_by: user?.id,
      });
      if (res.data.success) {
        openNotification('✅ Payment recorded', 'success');
        setShowManagerPaymentModal(false);
        setSelectedPurchaseForPayment(null);
        fetchData();
      }
    } catch (err) {
      openNotification('❌ ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSettleSubmit = async () => {
    if (!settleAlert) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return openNotification('Enter a valid amount', 'error');

    setSettling(true);
    try {
      const endpoint =
        settleAlert.type === 'part_order' ? `/orders/${settleAlert.id}/settle-credit` :
        settleAlert.type === 'work_order' ? `/work-orders/${settleAlert.id}/settle-credit` :
        `/purchase-orders/${settleAlert.id}/settle-credit`;
      const res = await api.put(endpoint, { amount: amt });
      if (res.data.success) {
        openNotification('✅ Credit settled!', 'success');
        setShowSettleModal(false);
        setSettleAlert(null);
        setSettleAmount('');
        fetchData();
      }
    } catch (err) {
      openNotification('❌ ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleApprovePartOrder = async (id) => openConfirmModal('Approve this part order?', async () => {
    setProcessingId(id);
    try {
      const res = await api.put(`/orders/${id}/approve-manager`);
      if (res.data.success) { openNotification('✅ Approved', 'success'); fetchData(); }
    } catch (err) { openNotification('❌ ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setProcessingId(null); }
  });

  const handleDenyPartOrder = async (id) => openConfirmModal('Deny this part order?', async () => {
    setProcessingId(id);
    try {
      await api.put(`/orders/${id}/deny-manager`);
      openNotification('Denied', 'error');
      fetchData();
    } catch (err) { openNotification('❌ ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setProcessingId(null); }
  });

  const handleApproveWorkOrder = async (id) => openConfirmModal('Approve this work order?', async () => {
    try {
      await api.put(`/work-orders/${id}/approve-manager`);
      openNotification('✅ Approved', 'success');
      fetchData();
    } catch (err) { openNotification('❌ ' + (err.response?.data?.error || err.message), 'error'); }
  });

  const handleDenyWorkOrder = async (id) => openConfirmModal('Deny this work order?', async () => {
    try {
      await api.put(`/work-orders/${id}/deny-manager`);
      openNotification('Denied', 'error');
      fetchData();
    } catch (err) { openNotification('❌ ' + (err.response?.data?.error || err.message), 'error'); }
  });

  const handleApprovePurchase = async (id) => openConfirmModal('Approve this purchase?', async () => {
    try {
      await api.put(`/purchase-orders/${id}/approve-manager`, { approved_by: user?.id });
      openNotification('✅ Approved', 'success');
      fetchData();
    } catch (err) { openNotification('❌ ' + (err.response?.data?.error || err.message), 'error'); }
  });

  const handleDenyPurchase = async (id) => openConfirmModal('Deny this purchase?', async () => {
    try {
      await api.put(`/purchase-orders/${id}/deny-manager`);
      openNotification('Denied', 'error');
      fetchData();
    } catch (err) { openNotification('❌ ' + (err.response?.data?.error || err.message), 'error'); }
  });

  const fetchData = async () => {
    setLoading(true);
    const t = (promise, ms = 10000) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

    try {
      try {
        const r = await t(api.get('/stats'));
        const s = r.data.stats || {};
        setStats({
          total_parts: s.total_parts || 0,
          total_quantity: s.total_quantity || 0,
          total_new_quantity: s.total_new_quantity || 0,
          total_used_quantity: s.total_used_quantity || 0,
          pending_manager_orders: s.pending_manager_orders || 0,
          low_stock_items: s.low_stock_items || [],
          low_stock_count: s.low_stock_count || 0,
          no_selling_price_items: s.no_selling_price_items || [],
          total_orders: s.total_orders || 0,
          completed_orders: s.completed_orders || 0,
        });
      } catch {}

      try { const r = await t(api.get('/orders/status/pending_manager')); setPendingOrders(r.data.orders || []); } catch { setPendingOrders([]); }
      try { const r = await t(api.get('/work-orders/with-parts?status=pending_manager')); setPendingWorkOrders(r.data.workOrders || []); } catch { setPendingWorkOrders([]); }
      try { const r = await t(api.get('/purchase-orders?status=pending_manager')); setPendingPurchases(r.data.orders || []); } catch { setPendingPurchases([]); }
      try { const r = await t(api.get('/purchase-orders?status=pending_manager_payment')); setPendingManagerPayments(r.data.orders || []); } catch { setPendingManagerPayments([]); }

      try {
        const r = await t(api.get('/petty-cash/balance'));
        setPettyCash({
          balance: r.data.balance || 0,
          allocated: r.data.total_allocated || 0,
          deducted: r.data.total_deducted || 0,
        });
      } catch {}

      try {
        const r = await t(api.get('/credit-alerts'));
        setCreditAlerts(r.data.alerts || []);
        setCreditCounts(r.data.counts || { total: 0, overdue: 0, critical: 0, urgent: 0, warning: 0 });
        const owed = (r.data.alerts || []).reduce((s, a) => s + (parseFloat(a.total_amount) || 0), 0);
        setTotalOwed(owed);
      } catch {}

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const noPriceItems = stats.no_selling_price_items || [];
  const totalPending =
    pendingPurchases.length + pendingManagerPayments.length +
    pendingWorkOrders.length + pendingOrders.length;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const tabs = [
    { key: 'purchases',  label: 'Purchases',         count: pendingPurchases.length,        color: 'blue' },
    { key: 'payments',   label: 'Large Payments',    count: pendingManagerPayments.length,  color: 'red' },
    { key: 'workorders', label: 'Work Orders',       count: pendingWorkOrders.length,       color: 'purple' },
    { key: 'partorders', label: 'Part Orders',       count: pendingOrders.length,           color: 'indigo' },
  ];

  const activeColor = {
    blue:   { bg: 'bg-blue-600',   hover: 'hover:bg-blue-50 hover:text-blue-700',   active: 'bg-blue-600 text-white shadow-md' },
    red:    { bg: 'bg-red-600',    hover: 'hover:bg-red-50 hover:text-red-700',     active: 'bg-red-600 text-white shadow-md' },
    purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-50 hover:text-purple-700', active: 'bg-purple-600 text-white shadow-md' },
    indigo: { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-50 hover:text-indigo-700', active: 'bg-indigo-600 text-white shadow-md' },
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400 opacity-10 rounded-full -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-purple-400 opacity-10 rounded-full -mb-16" />
        <div className="relative">
          <p className="text-cyan-300 text-xs uppercase tracking-widest font-semibold mb-1">
            {today}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Manager'} 👋
          </h1>
          <p className="text-blue-200 text-sm">
            {totalPending > 0
              ? `You have ${totalPending} item${totalPending !== 1 ? 's' : ''} waiting for your approval`
              : 'All caught up! Nothing pending right now'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 p-2 rounded-lg"><Package className="text-blue-600" size={18} /></div>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">STOCK</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.total_parts}</p>
          <p className="text-xs text-gray-500 mt-0.5">Unique Parts</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-indigo-100 p-2 rounded-lg"><Box className="text-indigo-600" size={18} /></div>
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">ITEMS</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.total_quantity}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Quantity</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="text-green-600" size={18} /></div>
            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">ORDERS</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.total_orders}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Orders</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-amber-100 p-2 rounded-lg"><Clock className="text-amber-600" size={18} /></div>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">PENDING</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{totalPending}</p>
          <p className="text-xs text-gray-500 mt-0.5">Awaiting You</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-100 p-2 rounded-lg"><Wallet className="text-purple-600" size={18} /></div>
            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">PETTY</span>
          </div>
          <p className="text-lg font-bold text-purple-700">ETB {pettyCash.balance.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Petty Cash</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-rose-100 p-2 rounded-lg"><CreditCard className="text-rose-600" size={18} /></div>
            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">CREDITS</span>
          </div>
          <p className="text-lg font-bold text-rose-700">ETB {totalOwed.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Owed to Us</p>
        </div>
      </div>

      {(creditCounts.overdue > 0 || stats.low_stock_count > 0 || noPriceItems.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {creditCounts.overdue > 0 && (
            <a href="/credits" className="bg-gradient-to-r from-red-500 to-rose-600 rounded-xl p-4 shadow-md hover:shadow-lg transition flex items-center gap-3 text-white">
              <div className="bg-white/20 p-2.5 rounded-lg"><AlertTriangle size={20} /></div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider opacity-90 font-semibold">Overdue Credits</p>
                <p className="text-lg font-bold">{creditCounts.overdue} overdue</p>
              </div>
              <ArrowRight size={18} />
            </a>
          )}
          {stats.low_stock_count > 0 && (
            <a href="/inventory" className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 shadow-md hover:shadow-lg transition flex items-center gap-3 text-white">
              <div className="bg-white/20 p-2.5 rounded-lg"><Box size={20} /></div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider opacity-90 font-semibold">Low Stock</p>
                <p className="text-lg font-bold">{stats.low_stock_count} items</p>
              </div>
              <ArrowRight size={18} />
            </a>
          )}
          {noPriceItems.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl p-4 shadow-md text-white">
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-white/20 p-2 rounded-lg"><DollarSign size={16} /></div>
                <p className="text-xs uppercase tracking-wider opacity-90 font-semibold flex-1">No Selling Price</p>
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">{noPriceItems.length}</span>
              </div>
              <p className="text-xs opacity-90">Set prices to sell these items</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock size={20} className="text-blue-600" />
                Pending Approvals
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Items waiting for your decision</p>
            </div>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
              {totalPending} total
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === tab.key
                    ? activeColor[tab.color].active
                    : `bg-white border border-gray-200 text-gray-600 ${activeColor[tab.color].hover}`
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.key ? 'bg-white bg-opacity-25' : activeColor[tab.color].bg + ' text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'purchases' && (
          pendingPurchases.length === 0 ? (
            <EmptyState icon={ShoppingCart} label="No purchase orders pending approval" />
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {pendingPurchases.map(po => (
                <div key={po.id} className="p-5 hover:bg-blue-50/40 transition">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-blue-600 font-bold">{po.order_number}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                          ETB {parseFloat(po.total_amount || 0).toFixed(2)}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          Qty: {po.quantity}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{po.item_description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                        <span>Seller: {po.seller_name || 'N/A'}</span>
                        {po.brand && <span>Brand: {po.brand}</span>}
                        <span>Condition: {po.condition || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        <EthiopianDate date={po.created_at} includeTime />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovePurchase(po.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                      >
                        <CheckCircle size={15} /> Approve
                      </button>
                      <button
                        onClick={() => handleDenyPurchase(po.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'payments' && (
          pendingManagerPayments.length === 0 ? (
            <EmptyState icon={DollarSign} label="No large payments pending" />
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {pendingManagerPayments.map(po => (
                <div key={po.id} className="p-5 hover:bg-red-50/40 transition">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-blue-600 font-bold">{po.order_number}</span>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                          ETB {parseFloat(po.total_amount || 0).toFixed(2)}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          &gt; 50k
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{po.item_description}</p>
                      <p className="text-xs text-gray-500 mt-1">Seller: {po.seller_name || 'N/A'}</p>
                      <div className="text-xs text-gray-400 mt-1">
                        <EthiopianDate date={po.created_at} includeTime />
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedPurchaseForPayment(po); setPaymentMethod(''); setOtherPaymentMethod(''); setReceiptNumber(''); setShowManagerPaymentModal(true); }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                    >
                      <DollarSign size={15} /> Pay Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'workorders' && (
          pendingWorkOrders.length === 0 ? (
            <EmptyState icon={Wrench} label="No work orders pending approval" />
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {pendingWorkOrders.map(wo => {
                const totalQty = (wo.work_order_parts || []).reduce((s, p) => s + (p.quantity || 0), 0);
                return (
                  <div key={wo.id} className="p-5 hover:bg-purple-50/40 transition">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-blue-600 font-bold">{wo.work_order_number}</span>
                          <span className="text-sm font-medium text-gray-800">{wo.customer_name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            Tech: {wo.assigned_technician}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {wo.work_order_parts?.length || 0} parts · {totalQty} units · Total: ETB {parseFloat(wo.total_price || 0).toFixed(2)}
                        </p>
                        <div className="text-xs text-gray-400 mt-1">
                          <EthiopianDate date={wo.created_at} includeTime />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveWorkOrder(wo.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                        >
                          <CheckCircle size={15} /> Approve
                        </button>
                        <button
                          onClick={() => handleDenyWorkOrder(wo.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                          Deny
                        </button>
                        <button
                          onClick={() => setSelectedWorkOrder(wo)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'partorders' && (
          pendingOrders.length === 0 ? (
            <EmptyState icon={Package} label="No part orders pending approval" />
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {pendingOrders.map(order => {
                const totalPrice = (order.order_items || []).reduce(
                  (s, i) => s + (i.selling_price_at_time || 0) * (i.quantity || 0), 0
                );
                return (
                  <div key={order.id} className="p-5 hover:bg-indigo-50/40 transition">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-blue-600 font-bold">{order.order_number}</span>
                          <span className="text-sm font-medium text-gray-800">{order.customer_name}</span>
                          {order.fs_number && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              FS#{order.fs_number}
                            </span>
                          )}
                          {order.payment_type === 'credit' && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                              CREDIT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {order.order_items?.length || 0} items · Total: ETB {totalPrice.toFixed(2)}
                        </p>
                        <div className="text-xs text-gray-400 mt-1">
                          <EthiopianDate date={order.requested_at || order.created_at} includeTime />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprovePartOrder(order.id)}
                          disabled={processingId === order.id}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckCircle size={15} /> Approve
                        </button>
                        <button
                          onClick={() => handleDenyPartOrder(order.id)}
                          disabled={processingId === order.id}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          Deny
                        </button>
                        <button
                          onClick={() => setSelectedPartOrder(order)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-100 p-2.5 rounded-xl">
              <Wallet size={22} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">Petty Cash</h3>
              <p className="text-xs text-gray-500">Weekly allocation balance</p>
            </div>
            <button
              onClick={() => setShowPettyCashModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <PlusCircle size={13} /> Add Funds
            </button>
          </div>
          <div className="flex items-end justify-between mb-3">
            <p className="text-3xl font-bold text-purple-700">ETB {pettyCash.balance.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              <p className="text-emerald-600 font-medium">Allocated</p>
              <p className="font-bold text-emerald-800">ETB {pettyCash.allocated.toFixed(2)}</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
              <p className="text-rose-600 font-medium">Deducted</p>
              <p className="font-bold text-rose-800">ETB {pettyCash.deducted.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-100 p-2.5 rounded-xl">
              <DollarSign size={22} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">Items Without Selling Price</h3>
              <p className="text-xs text-gray-500">Set prices to enable selling</p>
            </div>
            <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold">
              {noPriceItems.length}
            </span>
          </div>
          {noPriceItems.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
              <p className="text-sm text-gray-500">All items have selling prices ✓</p>
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {noPriceItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-blue-600 truncate">{item.item_code}</p>
                    <p className="text-xs font-medium text-gray-700 truncate">{item.item_name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSetPricePartId(item.id);
                      setSetPriceItemName(item.item_name);
                      setSetPriceValue(0);
                      setShowSetPriceModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded-lg font-medium whitespace-nowrap"
                  >
                    Set Price
                  </button>
                </div>
              ))}
              {noPriceItems.length > 5 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  +{noPriceItems.length - 5} more items
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ MODALS ============ */}

      {showSettleModal && settleAlert && (
        <Modal onClose={() => { setShowSettleModal(false); setSettleAlert(null); }} title="Settle Credit">
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <p className="font-mono font-bold text-blue-600">{settleAlert.order_number}</p>
            <p className="mt-1"><strong>Customer:</strong> {settleAlert.customer_name}</p>
            <p><strong>Due:</strong> {settleAlert.due_date ? <EthiopianDate date={settleAlert.due_date} /> : '—'}</p>
            <p className="text-lg font-bold mt-1 text-red-700">
              Amount Owed: ETB {(parseFloat(settleAlert.total_amount) || 0).toFixed(2)}
            </p>
          </div>
          <label className="block text-sm font-medium mb-1">Settlement Amount (ETB) *</label>
          <input
            type="number" min="0" step="0.01" value={settleAmount}
            onChange={(e) => setSettleAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
            autoFocus
          />
          <div className="flex gap-3 mt-5 pt-4 border-t">
            <button
              onClick={handleSettleSubmit}
              disabled={settling}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 font-medium disabled:opacity-50"
            >
              {settling ? 'Settling...' : 'Mark as Paid'}
            </button>
            <button onClick={() => { setShowSettleModal(false); setSettleAlert(null); }} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showPettyCashModal && (
        <Modal onClose={() => setShowPettyCashModal(false)} title="Set Petty Cash Allocation">
          <div className="space-y-4">
            <Field label="Amount (ETB) *">
              <input type="number" min="0" step="0.01" value={pettyCashAmount}
                onChange={(e) => setPettyCashAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </Field>
            <Field label="Week Start *">
              <input type="date" value={pettyCashWeekStart}
                onChange={(e) => setPettyCashWeekStart(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </Field>
            <Field label="Week End *">
              <input type="date" value={pettyCashWeekEnd}
                onChange={(e) => setPettyCashWeekEnd(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </Field>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t">
            <button onClick={handleSetPettyCash} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex-1 font-medium">
              Allocate
            </button>
            <button onClick={() => setShowPettyCashModal(false)} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showManagerPaymentModal && selectedPurchaseForPayment && (
        <Modal onClose={() => { setShowManagerPaymentModal(false); setSelectedPurchaseForPayment(null); }} title="Pay for Purchase">
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <p><strong>Order:</strong> <span className="font-mono">{selectedPurchaseForPayment.order_number}</span></p>
            <p><strong>Item:</strong> {selectedPurchaseForPayment.item_description}</p>
            <p className="text-2xl font-bold text-red-600 pt-1">
              ETB {selectedPurchaseForPayment.total_amount}
            </p>
          </div>
          <div className="space-y-4">
            <Field label="Payment Method *">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select payment method</option>
                <option>Bank Account</option>
                <option>Cash</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </Field>
            {paymentMethod === 'Other' && (
              <Field label="Specify *">
                <input type="text" value={otherPaymentMethod}
                  onChange={(e) => setOtherPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" />
              </Field>
            )}
            <Field label="Receipt Number *">
              <input type="text" value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </Field>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t">
            <button onClick={handleSubmitManagerPayment} disabled={submittingPayment}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 font-medium disabled:opacity-50">
              {submittingPayment ? 'Processing...' : 'Confirm Payment'}
            </button>
            <button onClick={() => { setShowManagerPaymentModal(false); setSelectedPurchaseForPayment(null); }}
              className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showConfirmModal && (
        <Modal onClose={() => setShowConfirmModal(false)} title="Confirm" size="sm">
          <p className="text-gray-700">{confirmMessage}</p>
          <div className="flex gap-3 mt-5 pt-4 border-t">
            <button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex-1 font-medium">
              Yes
            </button>
            <button onClick={() => setShowConfirmModal(false)} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">
              No
            </button>
          </div>
        </Modal>
      )}

      {showNotification && (
        <Modal onClose={closeNotification} title={notificationType === 'success' ? '✅ Success' : '❌ Error'} size="sm">
          <p className="text-gray-700">{notificationMessage}</p>
          <button
            onClick={closeNotification}
            className={`mt-4 w-full px-6 py-2 rounded-lg text-white font-medium ${
              notificationType === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            OK
          </button>
        </Modal>
      )}

      {showSetPriceModal && (
        <Modal onClose={() => setShowSetPriceModal(false)} title="Set Selling Price" size="sm">
          <p className="text-gray-600 mb-1 text-sm">For:</p>
          <p className="font-semibold text-lg mb-3">{setPriceItemName}</p>
          <Field label="Selling Price (ETB)">
            <input type="number" min="0" step="0.01" value={setPriceValue}
              onChange={(e) => setSetPriceValue(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg" autoFocus />
          </Field>
          <div className="flex gap-3 mt-5 pt-4 border-t">
            <button onClick={handleSetPriceSubmit} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex-1 font-medium">
              Save Price
            </button>
            <button onClick={() => setShowSetPriceModal(false)} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {selectedPartOrder && (
        <Modal onClose={() => setSelectedPartOrder(null)} title={selectedPartOrder.order_number} size="lg">
          <div className="space-y-2 mb-4 text-sm">
            <p><strong>Customer:</strong> {selectedPartOrder.customer_name}</p>
            <p><strong>FS:</strong> {selectedPartOrder.fs_number || '—'}</p>
            {selectedPartOrder.requested_at && (
              <p><strong>Requested:</strong> <EthiopianDate date={selectedPartOrder.requested_at} includeTime /></p>
            )}
            {selectedPartOrder.payment_type === 'credit' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                <p className="text-orange-700"><strong>Payment Type:</strong> CREDIT</p>
                <p className="text-orange-700">
                  <strong>Due Date:</strong> {selectedPartOrder.due_date ? <EthiopianDate date={selectedPartOrder.due_date} /> : '—'}
                </p>
              </div>
            )}
          </div>
          <h3 className="font-semibold mb-2 text-sm">Items</h3>
          <div className="space-y-1">
            {selectedPartOrder.order_items?.map(item => (
              <div key={item.id} className="flex justify-between border-b py-2 text-sm">
                <div>
                  <div className="font-medium">{item.parts?.item_name}</div>
                  <div className="text-xs text-gray-500">{item.parts?.item_code}</div>
                </div>
                <div className="text-right">
                  <div>Qty: {item.quantity}</div>
                  <div className="text-xs text-gray-500">ETB {item.selling_price_at_time?.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {selectedWorkOrder && (
        <Modal onClose={() => setSelectedWorkOrder(null)} title={selectedWorkOrder.work_order_number}>
          <div className="space-y-2 text-sm">
            <p><strong>Customer:</strong> {selectedWorkOrder.customer_name}</p>
            <p><strong>Technician:</strong> {selectedWorkOrder.assigned_technician}</p>
            <p><strong>Total:</strong> ETB {selectedWorkOrder.total_price || 0}</p>
            {selectedWorkOrder.created_at && (
              <p><strong>Created:</strong> <EthiopianDate date={selectedWorkOrder.created_at} includeTime /></p>
            )}
            {selectedWorkOrder.payment_type === 'credit' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                <p className="text-orange-700">
                  <strong>CREDIT</strong> — Due {selectedWorkOrder.due_date ? <EthiopianDate date={selectedWorkOrder.due_date} /> : '—'}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex bg-gray-100 p-4 rounded-full mb-3">
        <Icon size={32} className="text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-xs text-gray-400 mt-1">Nothing to do here right now</p>
    </div>
  );
}

function Modal({ children, onClose, title, size = 'md' }) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl w-full ${widths[size]} max-h-[90vh] overflow-y-auto p-6`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}

export default Manager;