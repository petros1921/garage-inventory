import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X } from 'lucide-react';

function PurchaseRequests() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
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
    notes: ''
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
    const total = (formData.quantity || 0) * (formData.purchase_price || 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  }, [formData.quantity, formData.purchase_price]);

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
        created_by: user.id
      };

      console.log('📦 Sending payload:', payload);

      const res = await api.post('/purchase-orders', payload);
      console.log('✅ Response:', res.data);

      if (res.data.success) {
        alert(`✅ Purchase order ${res.data.order.order_number} created!`);
        setShowModal(false);
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
          notes: ''
        });
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
      paid: 'bg-green-100 text-green-600',
      completed: 'bg-purple-100 text-purple-600',
      denied: 'bg-red-100 text-red-600'
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Purchase Requests</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> New Purchase Request
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No purchase requests.</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Order #</th>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Brand</th>
                <th className="px-4 py-2 text-left hidden lg:table-cell">Model</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Seller</th>
                <th className="px-4 py-2 text-left">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-blue-600">{order.order_number}</td>
                  <td className="px-4 py-2">{order.item_description}</td>
                  <td className="px-4 py-2 hidden md:table-cell">{order.brand || '-'}</td>
                  <td className="px-4 py-2 hidden lg:table-cell">{order.model || '-'}</td>
                  <td className="px-4 py-2 hidden md:table-cell">{order.seller_name || '-'}</td>
                  <td className="px-4 py-2">ETB {order.total_amount}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
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
                <div>
                  <label className="block text-sm font-medium">Total Amount (ETB)</label>
                  <input
                    type="number"
                    value={formData.total_amount}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
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
    </div>
  );
}

export default PurchaseRequests;