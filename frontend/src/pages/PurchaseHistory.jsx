import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, X } from 'lucide-react';

function PurchaseHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/purchase-orders');
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const filtered = orders.filter(o =>
    o.order_number?.toLowerCase().includes(filter.toLowerCase()) ||
    o.item_description?.toLowerCase().includes(filter.toLowerCase()) ||
    o.seller_name?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">Purchase History</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by order #, item, seller..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Order #</th>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-left hidden md:table-cell">Seller</th>
              <th className="px-4 py-2 text-left">Qty</th>
              <th className="px-4 py-2 text-left">Total</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left hidden lg:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                <td className="px-4 py-2 font-mono text-blue-600">{order.order_number}</td>
                <td className="px-4 py-2">{order.item_description}</td>
                <td className="px-4 py-2 hidden md:table-cell">{order.seller_name || '-'}</td>
                <td className="px-4 py-2">{order.quantity}</td>
                <td className="px-4 py-2">ETB {order.total_amount}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-2 hidden lg:table-cell text-gray-500">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedOrder.order_number}</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Item:</strong> {selectedOrder.item_description}</p>
              <p><strong>Seller:</strong> {selectedOrder.seller_name || 'N/A'}</p>
              <p><strong>Seller Type:</strong> {selectedOrder.seller_type}</p>
              <p><strong>Condition:</strong> {selectedOrder.condition}</p>
              <p><strong>Quantity:</strong> {selectedOrder.quantity}</p>
              <p><strong>Purchase Price:</strong> ETB {selectedOrder.purchase_price}</p>
              <p><strong>Total:</strong> ETB {selectedOrder.total_amount}</p>
              <p><strong>Status:</strong> {selectedOrder.status}</p>
              {selectedOrder.fs_number && <p><strong>FS#:</strong> {selectedOrder.fs_number}</p>}
              {selectedOrder.notes && <p><strong>Notes:</strong> {selectedOrder.notes}</p>}
              <p><strong>Created:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
              {selectedOrder.approved_at && (
                <p><strong>Approved:</strong> {new Date(selectedOrder.approved_at).toLocaleString()}</p>
              )}
              {selectedOrder.paid_at && (
                <p><strong>Paid:</strong> {new Date(selectedOrder.paid_at).toLocaleString()}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="mt-4 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseHistory;