import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X, Search, Package, Eye } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import EthiopianDate from '../components/EthiopianDate';

function PurchaseRequests() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [formData, setFormData] = useState({
    seller_name: '',
    seller_type: 'Spare Part Shop',
    item_description: '',
    brand: '',
    model: '',
    condition: 'New',
    quantity: 1,
    purchase_price: 0,
    total_amount: 0,
    notes: '',
    image_url: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/purchase-orders');
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('❌ Fetch orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const total = (parseFloat(formData.quantity) || 0) * (parseFloat(formData.purchase_price) || 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  }, [formData.quantity, formData.purchase_price]);

  const resetForm = () => {
    setFormData({
      seller_name: '',
      seller_type: 'Spare Part Shop',
      item_description: '',
      brand: '',
      model: '',
      condition: 'New',
      quantity: 1,
      purchase_price: 0,
      total_amount: 0,
      notes: '',
      image_url: null,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!user?.id) {
        alert('❌ You must be logged in. Please refresh.');
        setSubmitting(false);
        return;
      }

      const payload = {
        seller_name: formData.seller_name,
        seller_type: formData.seller_type,
        item_description: formData.item_description,
        brand: formData.brand,
        model: formData.model,
        condition: formData.condition,
        quantity: parseInt(formData.quantity) || 1,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        total_amount: (parseInt(formData.quantity) || 1) * (parseFloat(formData.purchase_price) || 0),
        notes: formData.notes,
        created_by: user.id,
        image_url: formData.image_url || null,
      };

      const res = await api.post('/purchase-orders', payload);

      if (res.data.success) {
        alert(`✅ Purchase order ${res.data.order.order_number} created!`);
        setShowModal(false);
        resetForm();
        fetchOrders();
      } else {
        alert('❌ Failed: ' + (res.data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('❌ Error details:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Unknown error';
      alert(`❌ Creation failed: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const classes = {
      pending_manager: 'bg-yellow-100 text-yellow-600',
      approved: 'bg-blue-100 text-blue-600',
      pending_payment: 'bg-orange-100 text-orange-600',
      pending_manager_payment: 'bg-red-100 text-red-600',
      paid: 'bg-green-100 text-green-600',
      completed: 'bg-purple-100 text-purple-600',
      credited: 'bg-orange-100 text-orange-700',
      denied: 'bg-red-100 text-red-600',
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.item_description || '').toLowerCase().includes(q) ||
      (o.seller_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Purchase Requests</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> New Purchase Request
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, item, seller..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No purchase requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(order => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-pointer"
            >
              {order.image_url ? (
                <img src={order.image_url} alt="Item" className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                  <Package size={36} className="text-blue-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs text-blue-600 font-bold">{order.order_number}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusBadge(order.status)}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="font-semibold text-gray-800 mb-1 truncate">{order.item_description}</p>
                <p className="text-xs text-gray-500 mb-2">{order.seller_name || 'No seller'}</p>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    Qty {order.quantity} × ETB {parseFloat(order.purchase_price || 0).toFixed(0)}
                  </div>
                  <span className="font-bold text-sm text-gray-800">
                    ETB {parseFloat(order.total_amount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                  <EthiopianDate date={order.created_at} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== CREATE MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">New Purchase Request</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Seller Name (optional)</label>
                  <input
                    type="text"
                    name="seller_name"
                    value={formData.seller_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Seller Type</label>
                  <select
                    name="seller_type"
                    value={formData.seller_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="Spare Part Shop">Spare Part Shop</option>
                    <option value="Individual">Individual</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Item Description *</label>
                  <input
                    type="text"
                    name="item_description"
                    required
                    value={formData.item_description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Brand</label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Model</label>
                    <input
                      type="text"
                      name="model"
                      value={formData.model}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium">Condition</label>
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Quantity *</label>
                    <input
                      type="number"
                      name="quantity"
                      required
                      min="1"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Purchase Price (ETB) *</label>
                    <input
                      type="number"
                      name="purchase_price"
                      required
                      min="0"
                      step="0.01"
                      value={formData.purchase_price}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium">Total Amount (ETB)</label>
                  <input
                    type="number"
                    value={formData.total_amount}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>

                {/* NEW: Image Upload */}
                <ImageUpload
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  label="Item Photo"
                  folder="purchase-orders"
                />

                <div>
                  <label className="block text-sm font-medium">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg resize-none"
                    rows="2"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Package size={20} className="text-blue-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{selectedOrder.order_number}</h2>
                  <p className="text-xs text-gray-500">Purchase request details</p>
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
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
                <p className="text-xs opacity-90">Total Amount</p>
                <p className="text-3xl font-bold">ETB {parseFloat(selectedOrder.total_amount || 0).toFixed(2)}</p>
                <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold bg-white bg-opacity-25 capitalize">
                  {selectedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>

              {selectedOrder.image_url && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item Photo</h3>
                  <a href={selectedOrder.image_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={selectedOrder.image_url}
                      alt="Item"
                      className="w-full h-56 object-cover rounded-lg border hover:opacity-90 transition"
                    />
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item</h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="font-medium">{selectedOrder.item_description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Brand</p>
                    <p className="font-medium">{selectedOrder.brand || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Model</p>
                    <p className="font-medium">{selectedOrder.model || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Condition</p>
                    <p className="font-medium">{selectedOrder.condition}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="font-medium">{selectedOrder.quantity}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Seller</h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium">{selectedOrder.seller_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="font-medium">{selectedOrder.seller_type || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pricing</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unit Price</span>
                    <span className="font-medium">ETB {parseFloat(selectedOrder.purchase_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity</span>
                    <span className="font-medium">{selectedOrder.quantity}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold text-blue-800">Total</span>
                    <span className="font-bold text-blue-800 text-lg">
                      ETB {parseFloat(selectedOrder.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Timeline</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <EthiopianDate date={selectedOrder.created_at} includeTime />
                  </div>
                  {selectedOrder.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Approved</span>
                      <EthiopianDate date={selectedOrder.approved_at} includeTime />
                    </div>
                  )}
                  {selectedOrder.paid_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid</span>
                      <EthiopianDate date={selectedOrder.paid_at} includeTime />
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm">{selectedOrder.notes}</div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseRequests;