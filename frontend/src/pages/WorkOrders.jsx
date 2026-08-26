import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Search, Wrench, X, Edit, Save, Plus, ShoppingCart } from 'lucide-react';

function WorkOrders() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    assigned_technician: '',
    status: '',
    diagnosis_notes: '',
    work_price: 0,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [notification, setNotification] = useState(null);

  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [partSearchResults, setPartSearchResults] = useState([]);
  const [isPartSearching, setIsPartSearching] = useState(false);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [partCart, setPartCart] = useState([]);

  // --- Helpers ---
  const getComputedPrices = (workOrder, cart, workPrice) => {
    const existingParts = workOrder?.work_order_parts || [];
    const allParts = [
      ...existingParts.map(p => ({
        selling_price: p.part?.selling_price || p.selling_price || 0,
        quantity: p.quantity || 1,
      })),
      ...cart.map(p => ({
        selling_price: p.selling_price || 0,
        quantity: p.quantity,
      })),
    ];
    const partPrice = allParts.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
    const total = (workPrice || 0) + partPrice;
    return { part_price: partPrice, total_price: total };
  };

  // --- Fetch ---
  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/work-orders/with-parts');
      console.log('Fetched work orders:', res.data.workOrders);
      setWorkOrders(res.data.workOrders || []);
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed to fetch work orders' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    console.log('Logged in user:', u);
    setUser(u);
    fetchWorkOrders();
  }, []);

  // --- Part search ---
  useEffect(() => {
    const delay = setTimeout(() => {
      if (partSearchTerm.length >= 2) {
        searchParts(partSearchTerm);
      } else {
        setPartSearchResults([]);
        setShowPartDropdown(false);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [partSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowPartDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchParts = async (q) => {
    setIsPartSearching(true);
    try {
      const res = await api.get(`/parts/search?q=${encodeURIComponent(q)}`);
      setPartSearchResults(res.data.parts || []);
      setShowPartDropdown(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPartSearching(false);
    }
  };

  const addToPartCart = (part) => {
    if (part.quantity <= 0 || !part.is_selling_price_set) {
      setNotification({ type: 'error', message: 'This part is not available for sale' });
      return;
    }
    setPartCart(prev => {
      const existing = prev.find(p => p.part_id === part.id);
      if (existing) {
        return prev.map(p =>
          p.part_id === part.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [...prev, {
        part_id: part.id,
        quantity: 1,
        selling_price: part.selling_price || 0,
        item_name: part.item_name,
        item_code: part.item_code,
        car_brand: part.car_brand,
        car_model: part.car_model,
      }];
    });
    setPartSearchTerm('');
    setPartSearchResults([]);
    setShowPartDropdown(false);
  };

  const removeFromPartCart = (partId) => {
    setPartCart(prev => prev.filter(p => p.part_id !== partId));
  };

  const updatePartCartQuantity = (partId, newQty) => {
    if (newQty < 1) {
      removeFromPartCart(partId);
      return;
    }
    setPartCart(prev => prev.map(p =>
      p.part_id === partId ? { ...p, quantity: newQty } : p
    ));
  };

  // --- Save edit ---
  const saveEditing = async () => {
    if (!selectedWorkOrder) return;
    setSavingEdit(true);
    try {
      const { part_price, total_price } = getComputedPrices(selectedWorkOrder, partCart, editData.work_price);

      await api.put(`/work-orders/${selectedWorkOrder.id}`, {
        assigned_technician: editData.assigned_technician,
        status: editData.status,
        diagnosis_notes: editData.diagnosis_notes,
        work_price: parseFloat(editData.work_price) || 0,
        part_price: part_price,
        total_price: total_price,
      });

      if (partCart.length > 0) {
        const partsToAdd = partCart.map(p => ({
          part_id: p.part_id,
          quantity: p.quantity,
        }));
        await api.post(`/work-orders/${selectedWorkOrder.id}/parts`, { parts: partsToAdd });
      }

      setNotification({ type: 'success', message: '✅ Work order updated' });
      setSelectedWorkOrder(null);
      setIsEditing(false);
      setPartCart([]);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Update failed') });
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Status handlers ---
  const handleCompleteAndSend = async (wo) => {
    if (!window.confirm('Complete this work order and send to Cashier?')) return;
    try {
      await api.put(`/work-orders/${wo.id}`, { status: 'completed' });
      setNotification({ type: 'success', message: '✅ Work order completed and sent to Cashier' });
      setSelectedWorkOrder(null);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Failed') });
    }
  };

  const handleSendToCashier = async (id) => {
    if (!window.confirm('Send this completed work order to Cashier for payment?')) return;
    try {
      await api.put(`/work-orders/${id}`, { status: 'pending_payment' });
      setNotification({ type: 'success', message: '✅ Work order sent to Cashier' });
      setSelectedWorkOrder(null);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Failed') });
    }
  };

  const handleSendToManager = async (id) => {
    if (!window.confirm('Send this work order to Manager for approval?')) return;
    try {
      await api.put(`/work-orders/${id}`, { status: 'pending_manager' });
      setNotification({ type: 'success', message: '✅ Work order sent to Manager' });
      setSelectedWorkOrder(null);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Failed') });
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this work order? It will be sent to Store Keeper.')) return;
    try {
      await api.put(`/work-orders/${id}`, { status: 'pending_storekeeper' });
      setNotification({ type: 'success', message: '✅ Work order approved, sent to Store Keeper' });
      setSelectedWorkOrder(null);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Failed') });
    }
  };

  const handleDeny = async (id) => {
    if (!window.confirm('Deny this work order?')) return;
    try {
      await api.put(`/work-orders/${id}`, { status: 'denied' });
      setNotification({ type: 'success', message: '❌ Work order denied' });
      setSelectedWorkOrder(null);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Failed') });
    }
  };

  const handleAddDiagnosis = async (id, notes) => {
    try {
      await api.put(`/work-orders/${id}`, { diagnosis_notes: notes });
      setNotification({ type: 'success', message: '✅ Diagnosis updated' });
      setSelectedWorkOrder(null);
      fetchWorkOrders();
    } catch (err) {
      setNotification({ type: 'error', message: '❌ ' + (err.response?.data?.error || 'Failed') });
    }
  };

  const startEditing = (wo) => {
    setEditData({
      assigned_technician: wo.assigned_technician || '',
      status: wo.status || 'pending_diagnosis',
      diagnosis_notes: wo.diagnosis_notes || '',
      work_price: wo.work_price || 0,
    });
    setPartCart([]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setPartCart([]);
    setPartSearchTerm('');
    setPartSearchResults([]);
  };

  const getStatusBadge = (status) => {
    const classes = {
      pending_diagnosis: 'bg-yellow-100 text-yellow-600',
      diagnosed: 'bg-blue-100 text-blue-600',
      fixing: 'bg-purple-100 text-purple-600',
      pending_manager: 'bg-orange-100 text-orange-600',
      pending_storekeeper: 'bg-indigo-100 text-indigo-600',
      completed: 'bg-green-100 text-green-600',
      pending_payment: 'bg-pink-100 text-pink-600',
      paid: 'bg-gray-100 text-gray-600',
      denied: 'bg-red-100 text-red-600',
      archived: 'bg-gray-200 text-gray-500',
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  // --- Filtering ---
  const filteredOrders = workOrders.filter(wo => {
    const matchesSearch =
      wo.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.assigned_technician?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.part_received?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // --- Render ---
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <Wrench size={24} className="text-blue-600" /> Work Orders
      </h1>

      {notification && (
        <div className={`p-3 rounded-lg mb-4 ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-4 text-sm font-bold">✕</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by customer, order #, technician..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending_diagnosis">Pending Diagnosis</option>
          <option value="diagnosed">Diagnosed</option>
          <option value="fixing">Fixing</option>
          <option value="pending_manager">Pending Manager</option>
          <option value="pending_storekeeper">Pending Store Keeper</option>
          <option value="completed">Completed</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Paid</option>
          <option value="denied">Denied</option>
        </select>
        <button
          onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
          className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm"
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-8">Loading...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No work orders found.</div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Part Received</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Technician</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parts</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map(wo => (
                <tr key={wo.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedWorkOrder(wo)}>
                  <td className="px-4 py-2 font-mono text-blue-600">{wo.work_order_number}</td>
                  <td className="px-4 py-2">{wo.customer_name}</td>
                  <td className="px-4 py-2 hidden md:table-cell">{wo.part_received || '-'}</td>
                  <td className="px-4 py-2">{wo.assigned_technician || '-'}</td>
                  <td className="px-4 py-2">{wo.work_order_parts?.length || 0}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(wo.status)}`}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">${wo.total_price || 0}</td>
                  <td className="px-4 py-2">
                    {wo.status === 'pending_diagnosis' && user?.role === 'frontdesk' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedWorkOrder(wo); }}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded"
                      >
                        View & Edit
                      </button>
                    )}
                    {wo.status === 'diagnosed' && user?.role === 'frontdesk' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendToManager(wo.id); }}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 rounded"
                      >
                        Send to Manager
                      </button>
                    )}
                    {wo.status === 'pending_manager' && (
                      <span className="text-xs text-orange-600">Waiting Approval</span>
                    )}
                    {wo.status === 'pending_storekeeper' && (
                      <span className="text-xs text-indigo-600">Awaiting Issuance</span>
                    )}
                    {wo.status === 'completed' && user?.role === 'frontdesk' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendToCashier(wo.id); }}
                        className="bg-pink-500 hover:bg-pink-600 text-white text-xs px-2 py-1 rounded"
                      >
                        Send to Cashier
                      </button>
                    )}
                    {wo.status === 'pending_payment' && (
                      <span className="text-xs text-pink-600">Awaiting Payment</span>
                    )}
                    {wo.status === 'paid' && (
                      <span className="text-xs text-gray-600">Paid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======== VIEW/EDIT MODAL ======== */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedWorkOrder.work_order_number}</h2>
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => startEditing(selectedWorkOrder)}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                  >
                    <Edit size={16} /> Edit
                  </button>
                ) : (
                  <button
                    onClick={cancelEditing}
                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
                  >
                    <X size={16} /> Cancel
                  </button>
                )}
                <button onClick={() => { setSelectedWorkOrder(null); setIsEditing(false); setPartCart([]); }} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* View Mode */}
            {!isEditing ? (
              <>
                <div className="space-y-2 text-sm">
                  <p><strong>Customer:</strong> {selectedWorkOrder.customer_name}</p>
                  <p><strong>Phone:</strong> {selectedWorkOrder.customer_phone || '-'}</p>
                  <p><strong>Part Received:</strong> {selectedWorkOrder.part_received || '-'}</p>
                  <p><strong>Customer Part #:</strong> {selectedWorkOrder.customer_part_number || '-'}</p>
                  <p><strong>Technician:</strong> {selectedWorkOrder.assigned_technician || '-'}</p>
                  <p><strong>Status:</strong> <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedWorkOrder.status)}`}>{selectedWorkOrder.status}</span></p>
                  <p><strong>Diagnosis:</strong> {selectedWorkOrder.diagnosis_notes || '-'}</p>
                  <p><strong>Work Price:</strong> ${selectedWorkOrder.work_price}</p>
                  <p><strong>Part Price:</strong> ${selectedWorkOrder.part_price}</p>
                  <p><strong>Total:</strong> ${selectedWorkOrder.total_price}</p>
                  <p><strong>FS#:</strong> {selectedWorkOrder.fs_number || 'Not set'}</p>
                </div>

                <h3 className="font-semibold mt-4 mb-2">Parts in Order</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                  {selectedWorkOrder.work_order_parts?.length > 0 ? (
                    selectedWorkOrder.work_order_parts.map(wp => {
                      // ✅ FIX: fallback to part.selling_price if wp.selling_price is missing
                      const price = wp.selling_price ?? wp.part?.selling_price ?? 0;
                      return (
                        <div key={wp.id} className="flex justify-between border-b py-1 text-sm">
                          <span>{wp.part?.item_name} ({wp.part?.item_code})</span>
                          <span>Qty: {wp.quantity}</span>
                          <span>Price: ${price}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-400">No parts added yet.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  {selectedWorkOrder.status === 'pending_diagnosis' && user?.role === 'frontdesk' && (
                    <button
                      onClick={() => {
                        const notes = prompt('Enter diagnosis notes:', selectedWorkOrder.diagnosis_notes || '');
                        if (notes !== null) {
                          handleAddDiagnosis(selectedWorkOrder.id, notes);
                        }
                      }}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm"
                    >
                      Add Diagnosis
                    </button>
                  )}
                  {selectedWorkOrder.status === 'diagnosed' && user?.role === 'frontdesk' && (
                    <button
                      onClick={() => handleSendToManager(selectedWorkOrder.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm"
                    >
                      Send to Manager
                    </button>
                  )}
                  {selectedWorkOrder.status === 'pending_manager' && user?.role === 'manager' && (
                    <>
                      <button
                        onClick={() => handleApprove(selectedWorkOrder.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDeny(selectedWorkOrder.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm"
                      >
                        Deny
                      </button>
                    </>
                  )}
                  {selectedWorkOrder.status === 'pending_storekeeper' && user?.role === 'storekeeper' && (
                    <button
                      onClick={() => handleCompleteAndSend(selectedWorkOrder)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm"
                    >
                      Issue Parts (Complete)
                    </button>
                  )}
                  {selectedWorkOrder.status === 'completed' && user?.role === 'frontdesk' && (
                    <button
                      onClick={() => handleSendToCashier(selectedWorkOrder.id)}
                      className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-1.5 rounded-lg text-sm"
                    >
                      Send to Cashier
                    </button>
                  )}
                  {selectedWorkOrder.status === 'pending_payment' && user?.role === 'cashier' && (
                    <button
                      onClick={() => {
                        if (window.confirm('Mark this work order as paid?')) {
                          api.put(`/work-orders/${selectedWorkOrder.id}`, { status: 'paid' })
                            .then(() => { setNotification({ type: 'success', message: '✅ Marked as paid' }); setSelectedWorkOrder(null); fetchWorkOrders(); })
                            .catch(err => setNotification({ type: 'error', message: '❌ ' + err.message }));
                        }
                      }}
                      className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm"
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* === EDIT MODE === */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Technician</label>
                  <input
                    type="text"
                    value={editData.assigned_technician}
                    onChange={(e) => setEditData({...editData, assigned_technician: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Status</label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({...editData, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="pending_diagnosis">Pending Diagnosis</option>
                    <option value="diagnosed">Diagnosed</option>
                    <option value="fixing">Fixing</option>
                    <option value="pending_manager">Pending Manager</option>
                    <option value="pending_storekeeper">Pending Store Keeper</option>
                    <option value="completed">Completed</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="paid">Paid</option>
                    <option value="archived">Archived</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Diagnosis Notes</label>
                  <textarea
                    value={editData.diagnosis_notes}
                    onChange={(e) => setEditData({...editData, diagnosis_notes: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Work Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editData.work_price}
                    onChange={(e) => {
                      setEditData(prev => ({ ...prev, work_price: parseFloat(e.target.value) || 0 }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {(() => {
                  const { part_price, total_price } = getComputedPrices(selectedWorkOrder, partCart, editData.work_price);
                  return (
                    <>
                      <div>
                        <label className="block text-sm font-medium">Part Price (auto)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={part_price}
                          disabled
                          className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Total Price (auto)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={total_price}
                          disabled
                          className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                    </>
                  );
                })()}

                {/* Show existing parts with fallback price */}
                {selectedWorkOrder.work_order_parts?.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm mb-2">Current Parts in Order</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {selectedWorkOrder.work_order_parts.map(wp => {
                        // ✅ FIX: fallback to part.selling_price if wp.selling_price is missing
                        const price = wp.selling_price ?? wp.part?.selling_price ?? 0;
                        return (
                          <div key={wp.id} className="flex justify-between items-center border-b pb-1">
                            <div>
                              <span className="font-medium">{wp.part?.item_name}</span>
                              <span className="text-sm text-gray-500 ml-2">({wp.part?.item_code})</span>
                              <span className="text-sm text-gray-500 ml-2">Qty: {wp.quantity}</span>
                            </div>
                            <div className="text-sm font-medium">${price}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Add new parts */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <ShoppingCart size={16} /> Add New Parts
                  </h4>
                  <div className="relative" ref={dropdownRef}>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search parts by name, code, brand..."
                      value={partSearchTerm}
                      onChange={(e) => setPartSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {isPartSearching && <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">Searching...</span>}
                    {showPartDropdown && partSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto mt-1 p-2 grid grid-cols-1 gap-2">
                        {partSearchResults.map(p => (
                          <div key={p.id} className="border rounded-lg p-3 hover:shadow-md transition flex justify-between items-start">
                            <div>
                              <div className="font-mono text-blue-600">{p.item_code}</div>
                              <div className="font-semibold">{p.item_name}</div>
                              <div className="text-sm text-gray-500">{p.car_brand} {p.car_model}</div>
                              <div className="text-sm">
                                Qty: {p.quantity} | Price: ${p.selling_price}
                                {p.quantity === 0 && <span className="text-red-500 ml-2">(Out of stock)</span>}
                                {!p.is_selling_price_set && <span className="text-yellow-500 ml-2">(Price not set)</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => addToPartCart(p)}
                              className={`bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${(p.quantity <= 0 || !p.is_selling_price_set) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={p.quantity <= 0 || !p.is_selling_price_set}
                            >
                              <Plus size={14} /> Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showPartDropdown && partSearchResults.length === 0 && partSearchTerm.length >= 2 && (
                      <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 p-2 text-sm text-gray-500">
                        No parts found.
                      </div>
                    )}
                  </div>

                  {partCart.length > 0 && (
                    <div className="mt-3 border rounded-lg p-3">
                      <h5 className="font-medium text-sm mb-2">New Parts to Add</h5>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {partCart.map(p => (
                          <div key={p.part_id} className="flex justify-between items-center border-b pb-1">
                            <div>
                              <span className="font-medium">{p.item_name}</span>
                              <span className="text-sm text-gray-500 ml-2">${p.selling_price}</span>
                              <div className="text-xs text-gray-400">{p.item_code}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updatePartCartQuantity(p.part_id, p.quantity - 1)} className="bg-gray-200 hover:bg-gray-300 w-5 h-5 rounded flex items-center justify-center">-</button>
                              <span className="w-6 text-center">{p.quantity}</span>
                              <button onClick={() => updatePartCartQuantity(p.part_id, p.quantity + 1)} className="bg-gray-200 hover:bg-gray-300 w-5 h-5 rounded flex items-center justify-center">+</button>
                              <button onClick={() => removeFromPartCart(p.part_id)} className="text-red-500 hover:text-red-700 ml-1">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        Total New Part Price: ${partCart.reduce((sum, p) => sum + (p.selling_price * p.quantity), 0).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={saveEditing}
                    disabled={savingEdit}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
                  >
                    <Save size={16} className="inline mr-1" /> {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrders;