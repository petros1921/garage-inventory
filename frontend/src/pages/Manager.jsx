import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';
import {
  Package, AlertTriangle, Clock, CheckCircle, User,
  DollarSign, ShoppingCart, Box, TrendingUp, X, PlusCircle,
  TrendingDown, Wallet, Calendar
} from 'lucide-react';

function Manager() {
  const [user, setUser] = useState(null);

  // --- Stats & Orders State ---
  const [stats, setStats] = useState({
    total_parts: 0,
    total_quantity: 0,
    total_new_quantity: 0,
    total_used_quantity: 0,
    pending_manager_orders: 0,
    low_stock_items: [],
    low_stock_count: 0,
    no_selling_price_items: [],
    category_breakdown: [],
    category_quantity_breakdown: [],
    total_orders: 0,
    completed_orders: 0
  });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingWorkOrders, setPendingWorkOrders] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [pendingManagerPayments, setPendingManagerPayments] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [orderTrend, setOrderTrend] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState({
    items_sold: 0,
    work_orders_completed: 0,
    work_orders_paid: 0,
    total_revenue: 0,
    avg_revenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // --- Petty Cash State ---
  const [pettyCashBalance, setPettyCashBalance] = useState(0);
  const [pettyCashTotalAllocated, setPettyCashTotalAllocated] = useState(0);
  const [pettyCashTotalDeducted, setPettyCashTotalDeducted] = useState(0);

  // --- Financial Overview State ---
  const [cashflowData, setCashflowData] = useState([]);
  const [financialStats, setFinancialStats] = useState({
    totalIncome: 0,
    totalSpending: 0,
    netProfit: 0
  });

  // --- Modal States ---
  const [selectedPartOrder, setSelectedPartOrder] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showNewItemsModal, setShowNewItemsModal] = useState(false);
  const [showUsedItemsModal, setShowUsedItemsModal] = useState(false);
  const [newItemsList, setNewItemsList] = useState([]);
  const [usedItemsList, setUsedItemsList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Confirm / Notification / Set Price
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

  // --- Petty Cash Modal ---
  const [showPettyCashModal, setShowPettyCashModal] = useState(false);
  const [pettyCashAmount, setPettyCashAmount] = useState('');
  const [pettyCashWeekStart, setPettyCashWeekStart] = useState('');
  const [pettyCashWeekEnd, setPettyCashWeekEnd] = useState('');

  // --- Manager Payment Modal ---
  const [showManagerPaymentModal, setShowManagerPaymentModal] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [otherPaymentMethod, setOtherPaymentMethod] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // --- Modal Functions ---
  const openConfirmModal = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (confirmAction) {
      await confirmAction();
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const openNotification = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
  };

  const closeNotification = () => setShowNotification(false);

  const openSetPriceModal = (partId, itemName, currentPrice) => {
    setSetPricePartId(partId);
    setSetPriceItemName(itemName);
    setSetPriceValue(currentPrice || 0);
    setShowSetPriceModal(true);
  };

  const handleSetPriceSubmit = async () => {
    if (!setPricePartId) return;
    if (isNaN(setPriceValue) || setPriceValue < 0) {
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
      openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // --- Petty Cash ---
  const handleSetPettyCash = async () => {
    if (!pettyCashAmount || parseFloat(pettyCashAmount) <= 0) {
      openNotification('Please enter a valid amount', 'error');
      return;
    }
    if (!pettyCashWeekStart || !pettyCashWeekEnd) {
      openNotification('Please select week range', 'error');
      return;
    }
    try {
      await api.post('/petty-cash/allocate', {
        amount: parseFloat(pettyCashAmount),
        week_start: pettyCashWeekStart,
        week_end: pettyCashWeekEnd,
        created_by: user?.id
      });
      openNotification('✅ Petty cash allocated successfully!', 'success');
      setShowPettyCashModal(false);
      setPettyCashAmount('');
      setPettyCashWeekStart('');
      setPettyCashWeekEnd('');
      fetchData();
    } catch (err) {
      openNotification('❌ ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // --- Manager Payment Modal ---
  const handleOpenPaymentModal = (purchase) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentMethod('');
    setOtherPaymentMethod('');
    setReceiptNumber('');
    setShowManagerPaymentModal(true);
  };

  const handleSubmitManagerPayment = async () => {
    if (!paymentMethod) {
      openNotification('Please select a payment method', 'error');
      return;
    }
    if (paymentMethod === 'Other' && !otherPaymentMethod.trim()) {
      openNotification('Please specify the payment method', 'error');
      return;
    }
    if (!receiptNumber.trim()) {
      openNotification('Please enter receipt number', 'error');
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await api.put(`/purchase-orders/${selectedPurchaseForPayment.id}/pay-manager`, {
        payment_method: paymentMethod === 'Other' ? otherPaymentMethod.trim() : paymentMethod,
        receipt_no: receiptNumber.trim(),
        paid_by: user?.id
      });
      if (res.data.success) {
        openNotification('✅ Purchase order paid by manager', 'success');
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

  // --- Fetch parts by condition ---
  const fetchPartsByCondition = async (condition) => {
    setLoadingList(true);
    try {
      const res = await api.get('/parts');
      const allParts = res.data.parts || [];
      return allParts.filter(p => p.condition === condition);
    } catch (err) {
      console.error(err);
      openNotification('❌ Failed to load parts', 'error');
      return [];
    } finally {
      setLoadingList(false);
    }
  };

  const openNewItemsModal = async () => {
    const parts = await fetchPartsByCondition('New');
    setNewItemsList(parts);
    setShowNewItemsModal(true);
  };

  const openUsedItemsModal = async () => {
    const parts = await fetchPartsByCondition('Used');
    setUsedItemsList(parts);
    setShowUsedItemsModal(true);
  };

  // --- Helper: group by month ---
  const groupByMonth = (items, dateKey, amountKey) => {
    const map = {};
    items.forEach(item => {
      const date = new Date(item[dateKey]);
      const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!map[monthKey]) map[monthKey] = 0;
      map[monthKey] += parseFloat(item[amountKey]) || 0;
    });
    // Sort by month
    const sorted = Object.keys(map).sort((a, b) => new Date(a) - new Date(b));
    return sorted.map(m => ({ month: m, value: map[m] }));
  };

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    console.log('🔄 Fetching dashboard data...');

    const fetchWithTimeout = (promise, timeoutMs = 10000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
        )
      ]);
    };

    try {
      // 1. Stats
      let statsData = {};
      try {
        const statsRes = await fetchWithTimeout(api.get('/stats'));
        statsData = statsRes.data.stats || {};
        console.log('✅ Stats fetched');
      } catch (statsErr) {
        console.error('❌ Stats error:', statsErr.message);
      }

      setStats({
        total_parts: statsData.total_parts || 0,
        total_quantity: statsData.total_quantity || 0,
        total_new_quantity: statsData.total_new_quantity || 0,
        total_used_quantity: statsData.total_used_quantity || 0,
        pending_manager_orders: statsData.pending_manager_orders || 0,
        low_stock_items: statsData.low_stock_items || [],
        low_stock_count: statsData.low_stock_count || 0,
        no_selling_price_items: statsData.no_selling_price_items || [],
        category_breakdown: statsData.category_breakdown || [],
        category_quantity_breakdown: statsData.category_quantity_breakdown || [],
        total_orders: statsData.total_orders || 0,
        completed_orders: statsData.completed_orders || 0
      });

      // 2. Pending Part Orders
      try {
        const pendingRes = await fetchWithTimeout(api.get('/orders/status/pending_manager'));
        setPendingOrders(pendingRes.data.orders || []);
        console.log(`✅ Pending part orders: ${pendingRes.data.orders?.length || 0}`);
      } catch (pendingErr) {
        console.error('❌ Pending part orders error:', pendingErr.message);
        setPendingOrders([]);
      }

      // 3. Pending Work Orders
      try {
        const woRes = await fetchWithTimeout(api.get('/work-orders/with-parts?status=pending_manager'));
        setPendingWorkOrders(woRes.data.workOrders || []);
        console.log(`✅ Pending work orders: ${woRes.data.workOrders?.length || 0}`);
      } catch (woErr) {
        console.error('❌ Pending work orders error:', woErr.message);
        setPendingWorkOrders([]);
      }

      // 4. Pending Purchase Orders (approval)
      try {
        const purchaseRes = await fetchWithTimeout(api.get('/purchase-orders?status=pending_manager'));
        setPendingPurchases(purchaseRes.data.orders || []);
        console.log(`✅ Pending purchase approvals: ${purchaseRes.data.orders?.length || 0}`);
      } catch (purchaseErr) {
        console.error('❌ Pending purchase approvals error:', purchaseErr.message);
        setPendingPurchases([]);
      }

      // 5. Pending Manager Payments (purchase orders > 50k)
      try {
        const managerPayRes = await fetchWithTimeout(api.get('/purchase-orders?status=pending_manager_payment'));
        setPendingManagerPayments(managerPayRes.data.orders || []);
        console.log(`✅ Pending manager payments: ${managerPayRes.data.orders?.length || 0}`);
      } catch (payErr) {
        console.error('❌ Pending manager payments error:', payErr.message);
        setPendingManagerPayments([]);
      }

      // 6. Completed Part Orders (for trend)
      try {
        const ordersRes = await fetchWithTimeout(api.get('/orders/all?limit=20'));
        const allOrders = ordersRes.data.orders || [];
        const completed = allOrders.filter(o => o.status === 'completed').slice(0, 10);
        setCompletedOrders(completed);

        const today = new Date();
        const trendMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          trendMap[key] = { date: key, count: 0 };
        }
        allOrders.forEach(o => {
          const dateStr = new Date(o.issued_at || o.created_at).toISOString().split('T')[0];
          if (trendMap[dateStr]) {
            trendMap[dateStr].count += 1;
          }
        });
        setOrderTrend(Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date)));
        console.log('✅ Completed part orders fetched');
      } catch (ordersErr) {
        console.error('❌ Orders error:', ordersErr.message);
        setCompletedOrders([]);
        setOrderTrend([]);
      }

      // 7. Monthly Summary
      try {
        const summaryRes = await fetchWithTimeout(api.get('/monthly-summary'));
        setMonthlySummary(summaryRes.data.summary || { items_sold: 0, work_orders_completed: 0, work_orders_paid: 0, total_revenue: 0, avg_revenue: 0 });
        console.log('✅ Monthly summary fetched');
      } catch (summaryErr) {
        console.error('❌ Monthly summary error:', summaryErr.message);
      }

      // 8. Petty Cash Balance
      try {
        const balanceRes = await fetchWithTimeout(api.get('/petty-cash/balance'));
        setPettyCashBalance(balanceRes.data.balance || 0);
        setPettyCashTotalAllocated(balanceRes.data.total_allocated || 0);
        setPettyCashTotalDeducted(balanceRes.data.total_deducted || 0);
        console.log('✅ Petty cash balance fetched');
      } catch (balanceErr) {
        console.error('❌ Petty cash balance error:', balanceErr.message);
      }

      // ===== REAL FINANCIAL DATA – FETCH ALL AND FILTER FOR PAID/COMPLETED =====
      let allPartOrders = [];
      let allWorkOrders = [];
      let allPurchaseOrders = [];

      // --- Part Orders (income) ---
      try {
        const res = await fetchWithTimeout(api.get('/orders/all?limit=1000'));
        allPartOrders = res.data.orders || [];
        console.log(`✅ Fetched ${allPartOrders.length} part orders`);
      } catch (err) {
        console.error('❌ Failed to fetch part orders for financials:', err.message);
      }

      // --- Work Orders (income) ---
      try {
        const res = await fetchWithTimeout(api.get('/work-orders/with-parts?limit=1000'));
        allWorkOrders = res.data.workOrders || [];
        console.log(`✅ Fetched ${allWorkOrders.length} work orders`);
      } catch (err) {
        console.error('❌ Failed to fetch work orders for financials:', err.message);
      }

      // --- Purchase Orders (spending) ---
      try {
        const res = await fetchWithTimeout(api.get('/purchase-orders?limit=1000'));
        allPurchaseOrders = res.data.orders || [];
        console.log(`✅ Fetched ${allPurchaseOrders.length} purchase orders`);
      } catch (err) {
        console.error('❌ Failed to fetch purchase orders for financials:', err.message);
      }

      // --- Compute Income from Part Orders ---
      const incomeByMonth = {};
      const paidPartOrders = allPartOrders.filter(o => o.status === 'completed' || o.status === 'paid');
      paidPartOrders.forEach(order => {
        const date = new Date(order.issued_at || order.created_at);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        let total = 0;
        if (order.order_items) {
          order.order_items.forEach(item => {
            total += (item.selling_price_at_time || 0) * (item.quantity || 0);
          });
        }
        if (!incomeByMonth[monthKey]) incomeByMonth[monthKey] = 0;
        incomeByMonth[monthKey] += total;
      });

      // --- Compute Income from Work Orders ---
      const paidWorkOrders = allWorkOrders.filter(wo => wo.status === 'paid' || wo.status === 'completed');
      paidWorkOrders.forEach(wo => {
        const date = new Date(wo.paid_at || wo.issued_at || wo.created_at);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        const total = parseFloat(wo.total_price) || 0;
        if (!incomeByMonth[monthKey]) incomeByMonth[monthKey] = 0;
        incomeByMonth[monthKey] += total;
      });

      // --- Compute Spending from Purchase Orders ---
      const spendingByMonth = {};
      const paidPurchaseOrders = allPurchaseOrders.filter(po => po.status === 'paid' || po.status === 'completed');
      paidPurchaseOrders.forEach(po => {
        const date = new Date(po.paid_at || po.updated_at || po.created_at);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        const total = parseFloat(po.total_amount) || 0;
        if (!spendingByMonth[monthKey]) spendingByMonth[monthKey] = 0;
        spendingByMonth[monthKey] += total;
      });

      // Merge months
      const allMonths = new Set([...Object.keys(incomeByMonth), ...Object.keys(spendingByMonth)]);
      const sortedMonths = Array.from(allMonths).sort((a, b) => new Date(a) - new Date(b));

      const cashflow = sortedMonths.map(month => ({
        month,
        income: incomeByMonth[month] || 0,
        spending: spendingByMonth[month] || 0
      }));

      setCashflowData(cashflow);

      const totalIncome = Object.values(incomeByMonth).reduce((a, b) => a + b, 0);
      const totalSpending = Object.values(spendingByMonth).reduce((a, b) => a + b, 0);
      setFinancialStats({
        totalIncome,
        totalSpending,
        netProfit: totalIncome - totalSpending
      });

      console.log(`💰 Total Income: ${totalIncome}, Total Spending: ${totalSpending}, Net: ${totalIncome - totalSpending}`);
      console.log('✅ Financial data computed from real data (all paid/completed orders)');

      console.log('✅ Dashboard data loaded');
    } catch (err) {
      console.error('🔥 Unexpected error:', err);
      openNotification('❌ Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  // Part Orders
  const handleApprovePartOrder = async (id) => {
    openConfirmModal('Approve this part order?', async () => {
      setProcessingId(id);
      try {
        const res = await api.put(`/orders/${id}/approve-manager`);
        if (res.data.success) {
          openNotification('✅ Part order approved!', 'success');
          fetchData();
        }
      } catch (err) {
        openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleDenyPartOrder = async (id) => {
    openConfirmModal('Deny this part order?', async () => {
      setProcessingId(id);
      try {
        const res = await api.put(`/orders/${id}/deny-manager`);
        if (res.data.success) {
          openNotification('❌ Part order denied.', 'error');
          fetchData();
        }
      } catch (err) {
        openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
      } finally {
        setProcessingId(null);
      }
    });
  };

  // Work Orders
  const handleApproveWorkOrder = async (id) => {
    openConfirmModal('Approve this work order?', async () => {
      try {
        await api.put(`/work-orders/${id}/approve-manager`);
        openNotification('✅ Work order approved!', 'success');
        fetchData();
      } catch (err) {
        openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
      }
    });
  };

  const handleDenyWorkOrder = async (id) => {
    openConfirmModal('Deny this work order?', async () => {
      try {
        await api.put(`/work-orders/${id}/deny-manager`);
        openNotification('❌ Work order denied.', 'error');
        fetchData();
      } catch (err) {
        openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
      }
    });
  };

  // Purchase Orders (approve/deny)
  const handleApprovePurchase = async (id) => {
    openConfirmModal('Approve this purchase order?', async () => {
      try {
        const res = await api.put(`/purchase-orders/${id}/approve-manager`, {
          approved_by: user?.id
        });
        if (res.data.success) {
          openNotification('✅ Purchase order approved', 'success');
          fetchData();
        }
      } catch (err) {
        openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
      }
    });
  };

  const handleDenyPurchase = async (id) => {
    openConfirmModal('Deny this purchase order?', async () => {
      try {
        await api.put(`/purchase-orders/${id}/deny-manager`);
        openNotification('❌ Purchase order denied.', 'error');
        fetchData();
      } catch (err) {
        openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
      }
    });
  };

  const handleSetPriceClick = (partId, itemName, currentPrice) => {
    openSetPriceModal(partId, itemName, currentPrice);
  };

  // --- Helper: status badge ---
  const getStatusBadge = (status) => {
    const classes = {
      pending_cashier: 'bg-yellow-100 text-yellow-600',
      pending_manager: 'bg-orange-100 text-orange-600',
      pending_storekeeper: 'bg-indigo-100 text-indigo-600',
      pending_manager_payment: 'bg-red-100 text-red-600',
      completed: 'bg-green-100 text-green-600',
      paid: 'bg-gray-100 text-gray-600',
      denied: 'bg-red-100 text-red-600'
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  // --- Initial fetch ---
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const lowStock = stats.low_stock_items || [];
  const totalParts = stats.total_parts || 0;
  const totalQuantity = stats.total_quantity || 0;
  const totalNewQty = stats.total_new_quantity || 0;
  const totalUsedQty = stats.total_used_quantity || 0;
  const pendingCount = stats.pending_manager_orders || 0;
  const noPriceItems = stats.no_selling_price_items || [];
  const categoryQuantityData = stats.category_quantity_breakdown || [];
  const totalOrders = stats.total_orders || 0;
  const completedOrdersCount = stats.completed_orders || 0;
  const { items_sold, work_orders_completed, total_revenue, avg_revenue } = monthlySummary;

  const orderStatusData = [
    { name: 'Completed Orders', value: completedOrdersCount },
    { name: 'Pending Orders', value: pendingCount }
  ];
  const ORDER_COLORS = ['#4CAF50', '#FF9800'];

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package size={24} className="text-blue-600" />
          Manager Dashboard
        </h1>
        <p className="text-gray-500 text-sm">Full overview of your garage inventory & orders</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Package className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Unique Parts</p>
              <p className="text-xl sm:text-2xl font-bold">{totalParts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Box className="text-indigo-600" size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Total Items</p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-600">{totalQuantity}</p>
            </div>
          </div>
        </div>

        <div
          className="bg-white border border-green-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition cursor-pointer hover:bg-green-50"
          onClick={openNewItemsModal}
        >
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">New Items (Qty)</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{totalNewQty}</p>
            </div>
          </div>
        </div>

        <div
          className="bg-white border border-yellow-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition cursor-pointer hover:bg-yellow-50"
          onClick={openUsedItemsModal}
        >
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <AlertTriangle className="text-yellow-600" size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Used Items (Qty)</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{totalUsedQty}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <Clock className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Pending Orders</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <ShoppingCart className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Total Orders</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600">{totalOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PETTY CASH BALANCE SECTION ===== */}
      <div className="bg-white border border-purple-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign size={24} className="text-purple-600" />
            <span className="font-semibold text-gray-700">Petty Cash Balance:</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-purple-700">ETB {pettyCashBalance.toFixed(2)}</span>
            <button
              onClick={() => setShowPettyCashModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
            >
              <PlusCircle size={14} /> Add Funds
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Total Allocated: ETB {pettyCashTotalAllocated.toFixed(2)} | Total Deducted: ETB {pettyCashTotalDeducted.toFixed(2)}
        </div>
      </div>

      {/* Monthly Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Items Sold</p>
              <p className="text-2xl font-bold text-blue-800">{items_sold}</p>
            </div>
            <div className="bg-blue-200 p-3 rounded-full">
              <TrendingUp size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Work Orders Completed</p>
              <p className="text-2xl font-bold text-green-800">{work_orders_completed}</p>
            </div>
            <div className="bg-green-200 p-3 rounded-full">
              <CheckCircle size={24} className="text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-purple-800">${total_revenue}</p>
            </div>
            <div className="bg-purple-200 p-3 rounded-full">
              <DollarSign size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 font-medium">Avg Revenue / Order</p>
              <p className="text-2xl font-bold text-amber-800">${avg_revenue}</p>
            </div>
            <div className="bg-amber-200 p-3 rounded-full">
              <BarChart size={24} className="text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== FINANCIAL OVERVIEW (REAL DATA) ===== */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Wallet className="text-emerald-600" size={22} />
          Financial Overview (Real Data)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Total Income</p>
                <p className="text-2xl font-bold text-emerald-800">${financialStats.totalIncome.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-200 p-3 rounded-full">
                <TrendingUp size={24} className="text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-rose-50 to-rose-100 border border-rose-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-rose-600 font-medium">Total Spending</p>
                <p className="text-2xl font-bold text-rose-800">${financialStats.totalSpending.toFixed(2)}</p>
              </div>
              <div className="bg-rose-200 p-3 rounded-full">
                <TrendingDown size={24} className="text-rose-600" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Net Profit</p>
                <p className={`text-2xl font-bold ${financialStats.netProfit >= 0 ? 'text-blue-800' : 'text-red-600'}`}>
                  ${financialStats.netProfit.toFixed(2)}
                </p>
              </div>
              <div className="bg-blue-200 p-3 rounded-full">
                <DollarSign size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Cashflow Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            Monthly Cashflow (from completed/paid orders)
          </h3>
          {cashflowData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-gray-400">
              No cashflow data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="spending" stroke="#f43f5e" strokeWidth={2} name="Spending" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row (existing) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">Order Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={orderStatusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ORDER_COLORS[index % ORDER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">Total Quantity by Category</h2>
          {categoryQuantityData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-gray-400">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryQuantityData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalQuantity" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ===== PENDING PURCHASE APPROVALS ===== */}
      <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-blue-200 bg-blue-50 flex justify-between items-center">
          <h2 className="font-semibold text-blue-800 flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-600" />
            Pending Purchase Approvals
          </h2>
          <div className="flex items-center gap-3">
            <span className="bg-blue-200 text-blue-700 px-2 py-1 rounded-full text-sm font-medium">
              {pendingPurchases.length} pending
            </span>
            <button
              onClick={() => setShowPettyCashModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
            >
              <PlusCircle size={14} /> Set Petty Cash
            </button>
          </div>
        </div>
        {pendingPurchases.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No purchase orders pending approval.</div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
            {pendingPurchases.map(po => (
              <div key={po.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-blue-600 font-bold">{po.order_number}</span>
                      <span className="text-sm font-medium text-gray-800">{po.item_description}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Qty: {po.quantity}</span>
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Total: ETB {po.total_amount}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                      <span>Brand: {po.brand || 'N/A'}</span>
                      <span>Model: {po.model || 'N/A'}</span>
                      <span>Seller: {po.seller_name || 'N/A'}</span>
                      <span>Condition: {po.condition}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprovePurchase(po.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDenyPurchase(po.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== PENDING MANAGER PAYMENTS (PURCHASE > 50k) ===== */}
      <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-red-200 bg-red-50 flex justify-between items-center">
          <h2 className="font-semibold text-red-800 flex items-center gap-2">
            <DollarSign size={18} className="text-red-600" />
            Pending Manager Payments (Purchase {'>'} 50k)
          </h2>
          <span className="bg-red-200 text-red-700 px-2 py-1 rounded-full text-sm font-medium">
            {pendingManagerPayments.length} pending
          </span>
        </div>
        {pendingManagerPayments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No purchase orders requiring manager payment.</div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
            {pendingManagerPayments.map(po => (
              <div key={po.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-blue-600 font-bold">{po.order_number}</span>
                      <span className="text-sm font-medium text-gray-800">{po.item_description}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Qty: {po.quantity}</span>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Total: ETB {po.total_amount}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                      <span>Brand: {po.brand || 'N/A'}</span>
                      <span>Model: {po.model || 'N/A'}</span>
                      <span>Seller: {po.seller_name || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenPaymentModal(po)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Pay (ETB {po.total_amount})
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== PENDING WORK ORDERS ===== */}
      <div className="bg-white border border-yellow-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-50 flex justify-between items-center">
          <h2 className="font-semibold text-yellow-800 flex items-center gap-2">
            <Clock size={18} className="text-yellow-600" />
            Pending Work Orders (Manager Approval)
          </h2>
          <span className="bg-yellow-200 text-yellow-700 px-2 py-1 rounded-full text-sm font-medium">
            {pendingWorkOrders.length} pending
          </span>
        </div>
        {pendingWorkOrders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No work orders pending approval.</div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
            {pendingWorkOrders.map(wo => {
              const totalQty = wo.work_order_parts?.reduce((s, p) => s + p.quantity, 0) || 0;
              const partsList = wo.work_order_parts?.map(p => `${p.part?.item_name} (${p.quantity})`).join(', ') || 'No parts';
              return (
                <div key={wo.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-blue-600 font-bold">{wo.work_order_number}</span>
                        <span className="text-sm font-medium text-gray-800">{wo.customer_name}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Tech: {wo.assigned_technician}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                        <span>Parts: <strong>{wo.work_order_parts?.length || 0}</strong></span>
                        <span>Total Qty: <strong>{totalQty}</strong></span>
                        <span>Total: <strong>${wo.total_price || 0}</strong></span>
                        <span className="text-xs text-gray-400">{new Date(wo.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate max-w-md">{partsList}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveWorkOrder(wo.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDenyWorkOrder(wo.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                      >
                        Deny
                      </button>
                      <button
                        onClick={() => setSelectedWorkOrder(wo)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== PENDING PART ORDERS (External Buyer) ===== */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            Pending Part Orders (Buyer)
          </h2>
          <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-medium">
            {pendingOrders.length} pending
          </span>
        </div>
        {pendingOrders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No part orders pending approval.</div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
            {pendingOrders.map(order => {
              const totalQty = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
              const totalPrice = order.order_items?.reduce((sum, item) => sum + (item.selling_price_at_time * item.quantity), 0) || 0;
              const itemsList = order.order_items?.map(item => `${item.parts?.item_name} (${item.quantity})`).join(', ') || 'No items';
              return (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-blue-600 font-bold">{order.order_number}</span>
                        <span className="text-sm font-medium text-gray-800">{order.customer_name} ({order.customer_type})</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{order.requested_by}</span>
                        {order.fs_number && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">FS#{order.fs_number}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                        <span>Items: <strong>{order.order_items?.length || 0}</strong></span>
                        <span>Total Qty: <strong>{totalQty}</strong></span>
                        <span>Total: <strong>${totalPrice.toFixed(2)}</strong></span>
                        <span className="text-xs text-gray-400">{new Date(order.requested_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate max-w-md">{itemsList}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovePartOrder(order.id)}
                        disabled={processingId === order.id}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button
                        onClick={() => handleDenyPartOrder(order.id)}
                        disabled={processingId === order.id}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition disabled:opacity-50"
                      >
                        <Clock size={16} /> Deny
                      </button>
                      <button
                        onClick={() => setSelectedPartOrder(order)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== ITEMS WITHOUT SELLING PRICE ===== */}
      {noPriceItems.length > 0 && (
        <div className="bg-white border border-yellow-200 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-50 flex justify-between items-center">
            <h2 className="font-semibold text-yellow-800 flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-600" />
              Items Without Selling Price
            </h2>
            <span className="bg-yellow-200 text-yellow-700 px-2 py-1 rounded-full text-sm font-medium">
              {noPriceItems.length} items
            </span>
          </div>
          <div className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
            {noPriceItems.map(item => (
              <div key={item.id} className="p-3 flex flex-wrap justify-between items-center hover:bg-gray-50">
                <div>
                  <span className="font-mono text-sm text-blue-600">{item.item_code}</span>
                  <span className="ml-2 text-gray-800">{item.item_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Purchase: ${item.purchase_price?.toFixed(2) || '0.00'}</span>
                  <button
                    onClick={() => handleSetPriceClick(item.id, item.item_name, 0)}
                    className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-3 py-1 rounded-lg transition font-medium"
                  >
                    Set Price
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Part Order Details Modal */}
      {selectedPartOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedPartOrder.order_number}</h2>
              <button onClick={() => setSelectedPartOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <p><strong>Customer:</strong> {selectedPartOrder.customer_name} ({selectedPartOrder.customer_type})</p>
              <p><strong>Requested By:</strong> {selectedPartOrder.requested_by}</p>
              <p><strong>FS Number:</strong> {selectedPartOrder.fs_number || 'Not set'}</p>
              <p><strong>Notes:</strong> {selectedPartOrder.notes || '-'}</p>
              <p><strong>Requested At:</strong> {new Date(selectedPartOrder.requested_at).toLocaleString()}</p>
            </div>
            <h3 className="font-semibold mb-2">Items</h3>
            <div className="space-y-2">
              {selectedPartOrder.order_items?.map(item => {
                const part = item.parts || {};
                return (
                  <div key={item.id} className="flex justify-between items-center border-b py-2">
                    <div>
                      <div className="font-medium">{part.item_name}</div>
                      <div className="text-sm text-gray-500">{part.item_code}</div>
                      <div className="text-sm text-gray-500">{part.car_brand} {part.car_model}</div>
                    </div>
                    <div className="text-right">
                      <div>Qty: {item.quantity}</div>
                      <div className="text-sm text-gray-500">${item.selling_price_at_time?.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setSelectedPartOrder(null)}
              className="mt-4 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Work Order Details Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedWorkOrder.work_order_number}</h2>
              <button onClick={() => setSelectedWorkOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2">
              <p><strong>Customer:</strong> {selectedWorkOrder.customer_name}</p>
              <p><strong>Phone:</strong> {selectedWorkOrder.customer_phone || '-'}</p>
              <p><strong>Part Received:</strong> {selectedWorkOrder.part_received || '-'}</p>
              <p><strong>Customer Part #:</strong> {selectedWorkOrder.customer_part_number || '-'}</p>
              <p><strong>Technician:</strong> {selectedWorkOrder.assigned_technician}</p>
              <p><strong>Status:</strong> {selectedWorkOrder.status}</p>
              <p><strong>Diagnosis:</strong> {selectedWorkOrder.diagnosis_notes || '-'}</p>
              <p><strong>Work Price:</strong> ${selectedWorkOrder.work_price || 0}</p>
              <p><strong>Part Price:</strong> ${selectedWorkOrder.part_price || 0}</p>
              <p><strong>Total:</strong> ${selectedWorkOrder.total_price || 0}</p>
              <p><strong>FS#:</strong> {selectedWorkOrder.fs_number || 'Not set'}</p>
              <p><strong>Created At:</strong> {new Date(selectedWorkOrder.created_at).toLocaleString()}</p>
              {selectedWorkOrder.approved_at && (
                <p><strong>Approved At:</strong> {new Date(selectedWorkOrder.approved_at).toLocaleString()}</p>
              )}
              {selectedWorkOrder.issued_at && (
                <p><strong>Issued At:</strong> {new Date(selectedWorkOrder.issued_at).toLocaleString()}</p>
              )}
              {selectedWorkOrder.paid_at && (
                <p><strong>Paid At:</strong> {new Date(selectedWorkOrder.paid_at).toLocaleString()}</p>
              )}
            </div>
            <h3 className="font-semibold mt-4 mb-2">Parts Used</h3>
            <div className="border rounded-lg p-2 max-h-40 overflow-y-auto">
              {selectedWorkOrder.work_order_parts?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-1 text-left">Part</th>
                      <th className="px-2 py-1 text-left">Code</th>
                      <th className="px-2 py-1 text-left">Quantity</th>
                      <th className="px-2 py-1 text-left">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkOrder.work_order_parts.map(wp => {
                      const price = wp.selling_price || wp.part?.selling_price || 0;
                      return (
                        <tr key={wp.id} className="border-b">
                          <td className="px-2 py-1">{wp.part?.item_name || 'Unknown'}</td>
                          <td className="px-2 py-1 font-mono text-blue-600">{wp.part?.item_code || 'N/A'}</td>
                          <td className="px-2 py-1">{wp.quantity}</td>
                          <td className="px-2 py-1">${price}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-400">No parts added.</p>
              )}
            </div>
            <button
              onClick={() => setSelectedWorkOrder(null)}
              className="mt-4 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* New Items Modal */}
      {showNewItemsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle size={20} /> New Items
              </h2>
              <button onClick={() => setShowNewItemsModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            {loadingList ? (
              <div className="text-center py-4">Loading...</div>
            ) : newItemsList.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No new items found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">Brand</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {newItemsList.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-blue-600">{item.item_code}</td>
                        <td className="px-4 py-2">{item.item_name}</td>
                        <td className="px-4 py-2">{item.car_brand || '-'}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={() => setShowNewItemsModal(false)}
              className="mt-4 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Used Items Modal */}
      {showUsedItemsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-yellow-600 flex items-center gap-2">
                <AlertTriangle size={20} /> Used Items
              </h2>
              <button onClick={() => setShowUsedItemsModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            {loadingList ? (
              <div className="text-center py-4">Loading...</div>
            ) : usedItemsList.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No used items found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">Brand</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {usedItemsList.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-blue-600">{item.item_code}</td>
                        <td className="px-4 py-2">{item.item_name}</td>
                        <td className="px-4 py-2">{item.car_brand || '-'}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={() => setShowUsedItemsModal(false)}
              className="mt-4 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Confirm</h2>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700">{confirmMessage}</p>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleConfirm}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex-1"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {notificationType === 'success' ? '✅ Success' : '❌ Error'}
              </h2>
              <button onClick={closeNotification} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700">{notificationMessage}</p>
            <button
              onClick={closeNotification}
              className={`mt-4 w-full px-6 py-2 rounded-lg text-white ${
                notificationType === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Set Price Modal */}
      {showSetPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Set Selling Price</h2>
              <button onClick={() => setShowSetPriceModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 mb-2">Set the selling price for:</p>
            <p className="font-semibold text-lg">{setPriceItemName}</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={setPriceValue}
                onChange={(e) => setSetPriceValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleSetPriceSubmit}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex-1"
              >
                Save Price
              </button>
              <button
                onClick={() => setShowSetPriceModal(false)}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PETTY CASH MODAL ===== */}
      {showPettyCashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Set Petty Cash Allocation</h2>
              <button onClick={() => setShowPettyCashModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Amount (ETB) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pettyCashAmount}
                  onChange={(e) => setPettyCashAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Week Start *</label>
                <input
                  type="date"
                  value={pettyCashWeekStart}
                  onChange={(e) => setPettyCashWeekStart(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Week End *</label>
                <input
                  type="date"
                  value={pettyCashWeekEnd}
                  onChange={(e) => setPettyCashWeekEnd(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleSetPettyCash}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex-1"
              >
                Allocate
              </button>
              <button
                onClick={() => setShowPettyCashModal(false)}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MANAGER PAYMENT MODAL ===== */}
      {showManagerPaymentModal && selectedPurchaseForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Pay for Purchase</h2>
              <button onClick={() => { setShowManagerPaymentModal(false); setSelectedPurchaseForPayment(null); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Order</p>
                <p className="font-semibold">{selectedPurchaseForPayment.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Item</p>
                <p className="font-semibold">{selectedPurchaseForPayment.item_description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-red-600">ETB {selectedPurchaseForPayment.total_amount}</p>
              </div>
              <div>
                <label className="block text-sm font-medium">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select payment method</option>
                  <option value="Bank Account">Bank Account</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other (specify below)</option>
                </select>
              </div>
              {paymentMethod === 'Other' && (
                <div>
                  <label className="block text-sm font-medium">Specify Payment Method *</label>
                  <input
                    type="text"
                    value={otherPaymentMethod}
                    onChange={(e) => setOtherPaymentMethod(e.target.value)}
                    placeholder="e.g., Mobile Money, Transfer, etc."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium">Receipt Number *</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="Enter receipt number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleSubmitManagerPayment}
                disabled={submittingPayment}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
              >
                {submittingPayment ? 'Processing...' : 'Confirm Payment'}
              </button>
              <button
                onClick={() => { setShowManagerPaymentModal(false); setSelectedPurchaseForPayment(null); }}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Manager;