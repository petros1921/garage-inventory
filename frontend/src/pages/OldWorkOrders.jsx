import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Archive, Search, Plus, Edit, Trash2, X, Save, User, Wrench,
  Phone, Calendar, Eye, FileText, Filter
} from 'lucide-react';
import EthiopianDate from '../components/EthiopianDate';
import EthiopianDatePicker from '../components/EthiopianDatePicker';

function OldWorkOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    wo_number: '',
    customer_name: '',
    customer_phone: '',
    part_received: '',
    technician_name: '',
    work_description: '',
    parts_used: '',
    total_amount: 0,
    status: 'paid',
    original_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/old-work-orders');
      setOrders(res.data.oldWorkOrders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      wo_number: '',
      customer_name: '',
      customer_phone: '',
      part_received: '',
      technician_name: '',
      work_description: '',
      parts_used: '',
      total_amount: 0,
      status: 'paid',
      original_date: '',
      notes: '',
    });
    setEditingId(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (o) => {
    setForm({
      wo_number: o.wo_number || '',
      customer_name: o.customer_name || '',
      customer_phone: o.customer_phone || '',
      part_received: o.part_received || '',
      technician_name: o.technician_name || '',
      work_description: o.work_description || '',
      parts_used: o.parts_used || '',
      total_amount: o.total_amount || 0,
      status: o.status || 'paid',
      original_date: o.original_date || '',
      notes: o.notes || '',
    });
    setEditingId(o.id);
    setShowForm(true);
    setSelectedOrder(null);
  };

  const handleSave = async () => {
    setError('');
    if (!form.customer_name.trim()) {
      setError('Customer name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, created_by: user?.id };
      const res = editingId
        ? await api.put(`/old-work-orders/${editingId}`, payload)
        : await api.post('/old-work-orders', payload);

      if (res.data.success) {
        setNotification({
          show: true,
          message: editingId ? '✅ Updated' : '✅ Old work order added',
          type: 'success',
        });
        setShowForm(false);
        resetForm();
        fetchOrders();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete old work order for ${name || 'this customer'}? This cannot be undone.`)) return;
    try {
      await api.delete(`/old-work-orders/${id}`);
      setNotification({ show: true, message: 'Deleted', type: 'success' });
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      setNotification({ show: true, message: 'Delete failed', type: 'error' });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || dateFrom || dateTo;

  // ===== Filtering =====
  const filtered = orders.filter(o => {
    // Date range filter — use original_date (fall back to created_at)
    if (dateFrom || dateTo) {
      const d = o.original_date || o.created_at;
      if (!d) return false;
      const itemDate = new Date(d);
      if (dateFrom && itemDate < new Date(dateFrom)) return false;
      if (dateTo && itemDate > new Date(dateTo + 'T23:59:59')) return false;
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (o.wo_number || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').toLowerCase().includes(q) ||
        (o.part_received || '').toLowerCase().includes(q) ||
        (o.technician_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const classes = {
      paid: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      archived: 'bg-gray-200 text-gray-600',
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Archive size={24} className="text-amber-600" />
            Old Work Orders (Archive)
          </h1>
          <p className="text-gray-500 text-sm">
            Historic work orders from before the system — {orders.length} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={18} /> Add Old Work Order
        </button>
      </div>

      {/* ===== Search + Filter Toggle ===== */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by WO#, customer, phone, part, technician..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
              showFilters || dateFrom || dateTo
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter size={16} /> Date Filter
            {(dateFrom || dateTo) && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 rounded-full">Active</span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 flex items-center gap-1"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* ===== Date Range Filter ===== */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              <EthiopianDatePicker
                label="From (ከ)"
                value={dateFrom}
                onChange={setDateFrom}
              />
              <EthiopianDatePicker
                label="To (እስከ)"
                value={dateTo}
                onChange={setDateTo}
              />
              <div className="flex flex-col justify-end">
                <p className="text-xs text-gray-500 mb-1">Quick ranges:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const now = new Date();
                      const from = new Date(now.getFullYear(), 0, 1);
                      setDateFrom(from.toISOString().split('T')[0]);
                      setDateTo(now.toISOString().split('T')[0]);
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium"
                  >
                    This Year
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const from = new Date(now);
                      from.setMonth(from.getMonth() - 6);
                      setDateFrom(from.toISOString().split('T')[0]);
                      setDateTo(now.toISOString().split('T')[0]);
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium"
                  >
                    Last 6 Months
                  </button>
                  <button
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium"
                  >
                    All Time
                  </button>
                </div>
              </div>
            </div>

            {/* Summary of active range */}
            {(dateFrom || dateTo) && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-amber-800">Showing:</span>
                {dateFrom ? (
                  <span className="text-amber-900">
                    from <EthiopianDate date={dateFrom} />
                  </span>
                ) : <span className="text-amber-900">beginning</span>}
                {dateTo ? (
                  <span className="text-amber-900">
                    to <EthiopianDate date={dateTo} />
                  </span>
                ) : <span className="text-amber-900">now</span>}
                <span className="ml-auto bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                  {filtered.length} order{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <Archive size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            {hasActiveFilters
              ? 'No old work orders match your filters.'
              : 'No old work orders yet. Click "Add Old Work Order" to start.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-amber-600 hover:text-amber-800 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">WO #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Part</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Technician</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(o => (
                <tr
                  key={o.id}
                  className="hover:bg-amber-50 cursor-pointer transition"
                  onClick={() => setSelectedOrder(o)}
                >
                  <td className="px-4 py-3 font-mono text-amber-700 font-semibold">{o.wo_number || '—'}</td>
                  <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">{o.customer_phone || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{o.part_received || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{o.technician_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    ETB {(parseFloat(o.total_amount) || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                    {o.original_date ? <EthiopianDate date={o.original_date} /> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(o); }}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-md"
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(o); }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-1.5 rounded-md"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(o.id, o.customer_name); }}
                        className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-md"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-amber-50 to-orange-50 border-b px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Archive size={20} className="text-amber-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedOrder.wo_number || 'Old Work Order'}
                  </h2>
                  <p className="text-xs text-gray-500">Archived Work Order Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-white">
                <p className="text-xs opacity-90">Total Amount</p>
                <p className="text-3xl font-bold">
                  ETB {(parseFloat(selectedOrder.total_amount) || 0).toFixed(2)}
                </p>
                <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold bg-white bg-opacity-25 capitalize">
                  {selectedOrder.status}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User size={12} /> Customer Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>
                    <p className="font-medium">{selectedOrder.customer_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={11} /> Phone
                    </p>
                    <p className="font-medium">{selectedOrder.customer_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Wrench size={12} /> Service Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Part Received</p>
                      <p className="font-medium">{selectedOrder.part_received || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Technician</p>
                      <p className="font-medium">{selectedOrder.technician_name || '—'}</p>
                    </div>
                  </div>
                  {selectedOrder.work_description && (
                    <div>
                      <p className="text-xs text-gray-500">Work Description</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedOrder.work_description}</p>
                    </div>
                  )}
                  {selectedOrder.parts_used && (
                    <div>
                      <p className="text-xs text-gray-500">Parts Used</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedOrder.parts_used}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Timeline
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  {selectedOrder.original_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Original Date</span>
                      <EthiopianDate date={selectedOrder.original_date} />
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Added to System</span>
                    <EthiopianDate date={selectedOrder.created_at} includeTime />
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText size={12} /> Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-3 flex gap-2">
              <button
                onClick={() => openEdit(selectedOrder)}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Edit size={16} /> Edit
              </button>
              <button
                onClick={() => handleDelete(selectedOrder.id, selectedOrder.customer_name)}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <Trash2 size={16} /> Delete
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FORM MODAL ===== */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Archive size={20} className="text-amber-600" />
                {editingId ? 'Edit Old Work Order' : 'Add Old Work Order'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">WO Number</label>
                <input
                  type="text"
                  value={form.wo_number}
                  onChange={(e) => setForm({ ...form, wo_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., WO-OLD-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Original Date</label>
                <input
                  type="date"
                  value={form.original_date}
                  onChange={(e) => setForm({ ...form, original_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                {form.original_date && (
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    <EthiopianDate date={form.original_date} />
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Part Received</label>
                <input
                  type="text"
                  value={form.part_received}
                  onChange={(e) => setForm({ ...form, part_received: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Technician</label>
                <input
                  type="text"
                  value={form.technician_name}
                  onChange={(e) => setForm({ ...form, technician_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Work Description</label>
                <textarea
                  rows="2"
                  value={form.work_description}
                  onChange={(e) => setForm({ ...form, work_description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Parts Used</label>
                <textarea
                  rows="2"
                  value={form.parts_used}
                  onChange={(e) => setForm({ ...form, parts_used: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., Alternator, Belt, Spark plugs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount (ETB)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="paid">Paid</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {notification.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {notification.type === 'success' ? '✅ Success' : '❌ Error'}
            </h2>
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

export default OldWorkOrders;