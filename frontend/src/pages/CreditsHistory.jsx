import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  CreditCard, AlertTriangle, CheckCircle, Clock, X,
  DollarSign, Search, Filter, Bell, Eye, Phone, Wrench,
  Package, User, Calendar, FileText
} from 'lucide-react';
import EthiopianDate from '../components/EthiopianDate';

const getUrgencyStyle = (urgency) => {
  switch (urgency) {
    case 'overdue':  return { row: 'bg-red-100 border-l-4 border-red-500',    badge: 'bg-red-600 text-white',    label: 'Overdue' };
    case 'critical': return { row: 'bg-red-50 border-l-4 border-red-400',     badge: 'bg-red-500 text-white',    label: 'Due Now' };
    case 'urgent':   return { row: 'bg-orange-50 border-l-4 border-orange-400', badge: 'bg-orange-500 text-white', label: 'Urgent' };
    case 'warning':  return { row: 'bg-yellow-50 border-l-4 border-yellow-400', badge: 'bg-yellow-500 text-white', label: 'Warning' };
    case 'settled':  return { row: 'bg-green-50 border-l-4 border-green-400', badge: 'bg-green-600 text-white',  label: 'Settled' };
    default:         return { row: 'bg-white border-l-4 border-gray-300',     badge: 'bg-gray-200 text-gray-700', label: 'Active' };
  }
};

const typeLabel = (type) => {
  switch (type) {
    case 'part_order':     return 'Part Order';
    case 'work_order':     return 'Work Order';
    case 'purchase_order': return 'Purchase';
    default:               return type;
  }
};

function CreditsHistory() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState([]);
  const [counts, setCounts] = useState({
    total: 0, active: 0, overdue: 0, settled: 0, total_owed: 0, total_collected: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleCredit, setSettleCredit] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settling, setSettling] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailType, setDetailType] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const res = await api.get('/credits/all', {
        params: { status: statusFilter, type: typeFilter }
      });
      setCredits(res.data.credits || []);
      setCounts(res.data.counts || { total: 0, active: 0, overdue: 0, settled: 0, total_owed: 0, total_collected: 0 });
    } catch (err) {
      console.error('Fetch credits error:', err);
      setCredits([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = async (credit) => {
    setDetailType(credit.type);
    setDetailLoading(true);
    setDetailData(null);
    setShowDetailModal(true);

    try {
      let res;
      if (credit.type === 'part_order') {
        res = await api.get(`/orders/${credit.id}`);
        setDetailData({ ...res.data.order, _summary: credit });
      } else if (credit.type === 'work_order') {
        res = await api.get(`/work-orders/${credit.id}`);
        setDetailData({ ...res.data.workOrder, _summary: credit });
      } else if (credit.type === 'purchase_order') {
        res = await api.get(`/purchase-orders/${credit.id}`);
        setDetailData({ ...res.data.order, _summary: credit });
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailData(null);
    setDetailType(null);
  };

  const openSettleModal = (credit) => {
    setSettleCredit(credit);
    setSettleAmount(credit.total_amount?.toString() || '0');
    setShowSettleModal(true);
  };

  const handleSettle = async () => {
    if (!settleCredit) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setNotification({ show: true, message: 'Please enter a valid amount', type: 'error' });
      return;
    }

    setSettling(true);
    try {
      const endpoint =
        settleCredit.type === 'part_order' ? `/orders/${settleCredit.id}/settle-credit` :
        settleCredit.type === 'work_order' ? `/work-orders/${settleCredit.id}/settle-credit` :
        `/purchase-orders/${settleCredit.id}/settle-credit`;

      const res = await api.put(endpoint, { amount: amt });
      if (res.data.success) {
        setNotification({ show: true, message: '✅ Credit settled successfully!', type: 'success' });
        setShowSettleModal(false);
        setSettleCredit(null);
        setSettleAmount('');
        fetchCredits();
      }
    } catch (err) {
      setNotification({
        show: true,
        message: '❌ ' + (err.response?.data?.error || err.message),
        type: 'error'
      });
    } finally {
      setSettling(false);
    }
  };

  const filteredCredits = credits.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.order_number || '').toLowerCase().includes(q) ||
      (c.customer_name || '').toLowerCase().includes(q)
    );
  });

  const filterTabs = [
    { key: 'all',     label: 'All',     count: counts.total,   color: 'text-gray-700',   activeBg: 'bg-gray-800 text-white' },
    { key: 'active',  label: 'Active',  count: counts.active,  color: 'text-orange-600', activeBg: 'bg-orange-600 text-white' },
    { key: 'overdue', label: 'Overdue', count: counts.overdue, color: 'text-red-600',    activeBg: 'bg-red-600 text-white' },
    { key: 'settled', label: 'Settled', count: counts.settled, color: 'text-green-600',  activeBg: 'bg-green-600 text-white' },
  ];

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CreditCard size={24} className="text-orange-600" />
          Credits Management
        </h1>
        <p className="text-gray-500 text-sm">All credit sales and purchases — track, filter, and settle</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 p-2 rounded-lg"><CreditCard className="text-gray-600" size={20} /></div>
            <div>
              <p className="text-xs text-gray-500">Total Credits</p>
              <p className="text-xl font-bold text-gray-800">{counts.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg"><Clock className="text-orange-600" size={20} /></div>
            <div>
              <p className="text-xs text-orange-600">Active</p>
              <p className="text-xl font-bold text-orange-700">{counts.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg"><AlertTriangle className="text-red-600" size={20} /></div>
            <div>
              <p className="text-xs text-red-600">Overdue</p>
              <p className="text-xl font-bold text-red-700">{counts.overdue}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="text-green-600" size={20} /></div>
            <div>
              <p className="text-xs text-green-600">Settled</p>
              <p className="text-xl font-bold text-green-700">{counts.settled}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Total Owed to Us</p>
              <p className="text-2xl font-bold text-red-800">ETB {counts.total_owed.toFixed(2)}</p>
            </div>
            <div className="bg-red-200 p-3 rounded-full">
              <DollarSign size={24} className="text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-800">ETB {counts.total_collected.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-200 p-3 rounded-full">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                statusFilter === tab.key ? tab.activeBg : `bg-gray-50 ${tab.color} hover:bg-gray-100`
              }`}
            >
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                statusFilter === tab.key ? 'bg-white bg-opacity-25' : 'bg-white border'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="part_order">Part Orders</option>
              <option value="work_order">Work Orders</option>
              <option value="purchase_order">Purchases</option>
            </select>
          </div>

          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order # or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading credits...</div>
      ) : filteredCredits.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <CreditCard size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No credits found for the selected filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Order #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer / Seller</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Days</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredits.map(c => {
                  const style = getUrgencyStyle(c.urgency);
                  const isSettled = !!c.credit_settled_at;
                  return (
                    <tr
                      key={`${c.type}-${c.id}`}
                      className={`${style.row} hover:bg-opacity-80 transition cursor-pointer`}
                      onClick={() => openDetailModal(c)}
                    >
                      <td className="px-4 py-3 font-mono text-blue-600 font-semibold whitespace-nowrap">
                        {c.order_number}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600 whitespace-nowrap">
                          {typeLabel(c.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                        ETB {(parseFloat(c.total_amount) || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {c.due_date ? <EthiopianDate date={c.due_date} /> : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isSettled ? (
                          <span className="text-green-600 font-semibold">—</span>
                        ) : c.days_until_due !== null ? (
                          <span className={`font-bold ${
                            c.days_until_due < 0 ? 'text-red-700' :
                            c.days_until_due <= 1 ? 'text-red-600' :
                            c.days_until_due <= 3 ? 'text-orange-600' :
                            c.days_until_due <= 5 ? 'text-yellow-600' : 'text-gray-600'
                          }`}>
                            {c.days_until_due < 0
                              ? `${Math.abs(c.days_until_due)}d overdue`
                              : c.days_until_due === 0 ? 'Today'
                              : `${c.days_until_due}d`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${style.badge}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openDetailModal(c); }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                          >
                            <Eye size={14} /> View
                          </button>
                          {!isSettled && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openSettleModal(c); }}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                            >
                              <DollarSign size={14} /> Settle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== DETAIL MODAL ========== */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  detailType === 'work_order' ? 'bg-purple-100' :
                  detailType === 'part_order' ? 'bg-blue-100' : 'bg-orange-100'
                }`}>
                  {detailType === 'work_order' ? <Wrench size={20} className="text-purple-600" /> :
                   detailType === 'part_order' ? <Package size={20} className="text-blue-600" /> :
                   <CreditCard size={20} className="text-orange-600" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {typeLabel(detailType)} Details
                  </h2>
                  <p className="text-xs text-gray-500">{typeLabel(detailType)}</p>
                </div>
              </div>
              <button onClick={closeDetailModal} className="text-gray-500 hover:text-gray-700 p-2">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-3">Loading details...</p>
                </div>
              ) : !detailData ? (
                <div className="text-center py-12 text-red-500">
                  Failed to load details.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Order Number</p>
                        <p className="font-mono text-lg font-bold text-blue-600">
                          {detailData._summary?.order_number || detailData.order_number || detailData.work_order_number}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="text-2xl font-bold text-gray-800">
                          ETB {(parseFloat(detailData._summary?.total_amount) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {detailData._summary && (
                    <div className={`rounded-xl p-4 border-2 ${getUrgencyStyle(detailData._summary.urgency).row}`}>
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Credit Status</p>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getUrgencyStyle(detailData._summary.urgency).badge}`}>
                            {getUrgencyStyle(detailData._summary.urgency).label}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Due Date</p>
                          <p className="font-semibold">
                            {detailData._summary.due_date ? <EthiopianDate date={detailData._summary.due_date} /> : '-'}
                          </p>
                        </div>
                        {!detailData._summary.credit_settled_at && detailData._summary.days_until_due !== null && (
                          <div>
                            <p className="text-xs text-gray-500">Days Remaining</p>
                            <p className={`font-bold text-lg ${
                              detailData._summary.days_until_due < 0 ? 'text-red-700' :
                              detailData._summary.days_until_due <= 1 ? 'text-red-600' :
                              detailData._summary.days_until_due <= 3 ? 'text-orange-600' : 'text-gray-700'
                            }`}>
                              {detailData._summary.days_until_due < 0
                                ? `${Math.abs(detailData._summary.days_until_due)} days overdue`
                                : detailData._summary.days_until_due === 0 ? 'Due today'
                                : `${detailData._summary.days_until_due} days`}
                            </p>
                          </div>
                        )}
                        {detailData._summary.credit_settled_at && (
                          <div>
                            <p className="text-xs text-gray-500">Settled On</p>
                            <p className="font-semibold text-green-700">
                              <EthiopianDate date={detailData._summary.credit_settled_at} />
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {detailType === 'work_order' && (
                    <>
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <User size={16} className="text-gray-500" /> Customer Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                          <div>
                            <p className="text-xs text-gray-500">Full Name</p>
                            <p className="font-medium">{detailData.customer_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12} /> Phone Number</p>
                            <p className="font-medium">{detailData.customer_phone || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Package size={16} className="text-gray-500" /> Part Received
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                          <div>
                            <p className="text-xs text-gray-500">Part Description</p>
                            <p className="font-medium">{detailData.part_received || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Customer's Part Number</p>
                            <p className="font-mono font-medium">{detailData.customer_part_number || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Wrench size={16} className="text-gray-500" /> Technician & Diagnosis
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <div>
                            <p className="text-xs text-gray-500">Assigned Technician</p>
                            <p className="font-medium">{detailData.assigned_technician || detailData.technician_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Diagnosis Notes</p>
                            <p className="font-medium whitespace-pre-wrap">{detailData.diagnosis_notes || 'No diagnosis notes recorded.'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Package size={16} className="text-gray-500" /> Parts Used ({detailData.work_order_parts?.length || 0})
                        </h3>
                        {detailData.work_order_parts?.length > 0 ? (
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold">Part</th>
                                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                                  <th className="px-3 py-2 text-center font-semibold">Qty</th>
                                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailData.work_order_parts.map(wp => {
                                  const price = wp.selling_price_at_time || wp.selling_price || wp.part?.selling_price || 0;
                                  return (
                                    <tr key={wp.id} className="border-b last:border-0">
                                      <td className="px-3 py-2">{wp.part?.item_name || 'Unknown'}</td>
                                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{wp.part?.item_code || 'N/A'}</td>
                                      <td className="px-3 py-2 text-center">{wp.quantity}</td>
                                      <td className="px-3 py-2 text-right">ETB {(price * wp.quantity).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">No parts used.</p>
                        )}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-800 mb-3">Pricing Breakdown</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Work Price (Labor)</span>
                            <span className="font-medium">ETB {(detailData.labor_charge || detailData.work_price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Machine Cost</span>
                            <span className="font-medium">ETB {(detailData.machine_cost || detailData.machine_price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Parts Cost</span>
                            <span className="font-medium">ETB {(detailData.total_parts_cost || detailData.part_price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-bold text-blue-800">Total</span>
                            <span className="font-bold text-blue-800 text-lg">
                              ETB {(detailData.total_amount || detailData.total_price || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Calendar size={16} className="text-gray-500" /> Timeline
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Created</span>
                            <EthiopianDate date={detailData.created_at} includeTime />
                          </div>
                          {detailData.approved_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Approved</span>
                              <EthiopianDate date={detailData.approved_at} includeTime />
                            </div>
                          )}
                          {detailData.issued_at && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Issued</span>
                              <EthiopianDate date={detailData.issued_at} includeTime />
                            </div>
                          )}
                          {detailData.fs_number && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">FS Number</span>
                              <span className="font-mono font-semibold text-purple-600">{detailData.fs_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {detailType === 'part_order' && (
                    <>
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <User size={16} className="text-gray-500" /> Customer Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                          <div>
                            <p className="text-xs text-gray-500">Customer Name</p>
                            <p className="font-medium">{detailData.customer_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Customer Type</p>
                            <p className="font-medium">{detailData.customer_type || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Requested By</p>
                            <p className="font-medium">{detailData.requested_by || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">FS Number</p>
                            <p className="font-mono font-semibold text-purple-600">{detailData.fs_number || 'Not set'}</p>
                          </div>
                          {detailData.notes && (
                            <div className="sm:col-span-2">
                              <p className="text-xs text-gray-500">Notes</p>
                              <p className="font-medium">{detailData.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Package size={16} className="text-gray-500" /> Items Ordered ({detailData.order_items?.length || 0})
                        </h3>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Part</th>
                                <th className="px-3 py-2 text-left font-semibold">Code</th>
                                <th className="px-3 py-2 text-center font-semibold">Qty</th>
                                <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
                                <th className="px-3 py-2 text-right font-semibold">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.order_items?.map(item => (
                                <tr key={item.id} className="border-b last:border-0">
                                  <td className="px-3 py-2">
                                    <div className="font-medium">{item.parts?.item_name || '-'}</div>
                                    <div className="text-xs text-gray-500">
                                      {item.parts?.car_brand} {item.parts?.car_model}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs text-blue-600">{item.parts?.item_code || 'N/A'}</td>
                                  <td className="px-3 py-2 text-center">{item.quantity}</td>
                                  <td className="px-3 py-2 text-right">ETB {(item.selling_price_at_time || 0).toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right font-semibold">
                                    ETB {((item.selling_price_at_time || 0) * item.quantity).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex justify-between">
                          <span className="font-bold text-blue-800">Grand Total</span>
                          <span className="font-bold text-blue-800 text-lg">
                            ETB {(parseFloat(detailData._summary?.total_amount) || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {detailType === 'purchase_order' && (
                    <>
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <User size={16} className="text-gray-500" /> Supplier Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                          <div>
                            <p className="text-xs text-gray-500">Seller Name</p>
                            <p className="font-medium">{detailData.seller_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Seller Type</p>
                            <p className="font-medium">{detailData.seller_type || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Package size={16} className="text-gray-500" /> Item Details
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                          <div className="sm:col-span-2">
                            <p className="text-xs text-gray-500">Description</p>
                            <p className="font-medium">{detailData.item_description || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Brand</p>
                            <p className="font-medium">{detailData.brand || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Model</p>
                            <p className="font-medium">{detailData.model || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Condition</p>
                            <p className="font-medium">{detailData.condition || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Quantity</p>
                            <p className="font-medium">{detailData.quantity || 0}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Purchase Price (per unit)</span>
                            <span className="font-medium">ETB {(parseFloat(detailData.purchase_price) || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-bold text-blue-800">Total</span>
                            <span className="font-bold text-blue-800 text-lg">
                              ETB {(parseFloat(detailData.total_amount) || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {detailData.notes && (
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <FileText size={16} className="text-gray-500" /> Notes
                          </h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="whitespace-pre-wrap">{detailData.notes}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    {detailData._summary && !detailData._summary.credit_settled_at && (
                      <button
                        onClick={() => {
                          closeDetailModal();
                          openSettleModal(detailData._summary);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 flex items-center justify-center gap-2"
                      >
                        <DollarSign size={18} /> Settle Credit
                      </button>
                    )}
                    <button
                      onClick={closeDetailModal}
                      className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {showSettleModal && settleCredit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Settle Credit</h2>
              <button
                onClick={() => { setShowSettleModal(false); setSettleCredit(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500">Order</p>
              <p className="font-mono font-bold text-blue-600">{settleCredit.order_number}</p>
              <p className="text-sm mt-1"><strong>Customer:</strong> {settleCredit.customer_name}</p>
              <p className="text-sm"><strong>Type:</strong> {typeLabel(settleCredit.type)}</p>
              <p className="text-sm">
                <strong>Due:</strong> {settleCredit.due_date ? <EthiopianDate date={settleCredit.due_date} /> : '-'}
              </p>
              <p className="text-lg font-bold mt-2 text-red-700">
                Amount Owed: ETB {(parseFloat(settleCredit.total_amount) || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Settlement Amount (ETB) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t">
              <button
                onClick={handleSettle}
                disabled={settling}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
              >
                {settling ? 'Settling...' : 'Mark as Paid'}
              </button>
              <button
                onClick={() => { setShowSettleModal(false); setSettleCredit(null); }}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {notification.type === 'success' ? '✅ Success' : '❌ Error'}
              </h2>
              <button
                onClick={() => setNotification({ show: false, message: '', type: 'success' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700">{notification.message}</p>
            <button
              onClick={() => setNotification({ show: false, message: '', type: 'success' })}
              className={`mt-4 w-full px-6 py-2 rounded-lg text-white ${
                notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreditsHistory;