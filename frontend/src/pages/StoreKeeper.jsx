import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CheckCircle, Eye, X, Package } from 'lucide-react';

function StoreKeeper() {
  const [workOrders, setWorkOrders] = useState([]);
  const [partOrders, setPartOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const workRes = await api.get('/work-orders/with-parts?status=pending_storekeeper');
      setWorkOrders(workRes.data.workOrders || []);
      const partRes = await api.get('/orders/status/pending_storekeeper');
      setPartOrders(partRes.data.orders || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueWorkOrder = async (orderId) => {
    if (processing) return; // prevent double click
    setProcessing(orderId);
    try {
      const res = await api.put(`/work-orders/${orderId}/issue-storekeeper`, {
        storekeeper_user_id: user?.id
      });
      if (res.data.success) {
        alert('✅ Work order issued, stock updated');
        // Immediately remove from UI to avoid double issue
        setWorkOrders(prev => prev.filter(o => o.id !== orderId));
        fetchOrders(); // refresh
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to issue work order';
      alert(`❌ ${msg}`);
      // If the error says already issued, we can also refresh to remove it
      if (msg.includes('already been issued') || msg.includes('not ready for issuance')) {
        fetchOrders();
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleIssuePartOrder = async (orderId) => {
    if (processing) return;
    setProcessing(orderId);
    try {
      const res = await api.put(`/orders/${orderId}/issue-storekeeper`, {
        storekeeper_user_id: user?.id
      });
      if (res.data.success) {
        alert('✅ Part order issued, stock updated');
        setPartOrders(prev => prev.filter(o => o.id !== orderId));
        fetchOrders();
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to issue part order';
      alert(`❌ ${msg}`);
      if (msg.includes('already been issued') || msg.includes('not ready for issuance')) {
        fetchOrders();
      }
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Store Keeper – Orders to Issue</h1>

      {/* Work Orders */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-blue-700 mb-3 flex items-center gap-2">
          <Package size={20} />
          Work Orders to Issue ({workOrders.length})
        </h2>
        {workOrders.length === 0 ? (
          <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No work orders to issue.</div>
        ) : (
          <div className="space-y-3">
            {workOrders.map(order => {
              const totalQty = order.work_order_parts?.reduce((sum, item) => sum + item.quantity, 0) || 0;
              const totalParts = order.work_order_parts?.length || 0;
              return (
                <div key={order.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-600 font-bold">{order.work_order_number}</span>
                        <span className="text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Ready to Issue</span>
                      </div>
                      <div className="text-sm mt-1">
                        <p><strong>Customer:</strong> {order.customer_name} (Technician)</p>
                        <p><strong>FS#:</strong> {order.fs_number || 'Not set'}</p>
                        <p><strong>Items:</strong> {totalParts} parts ({totalQty} total units)</p>
                        <p><strong>Technician:</strong> {order.assigned_technician}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedOrder(order); setSelectedType('work'); }}
                        className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
                      >
                        <Eye size={16} /> View
                      </button>
                      <button
                        onClick={() => handleIssueWorkOrder(order.id)}
                        disabled={processing === order.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Issue All
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Part Orders */}
      <div>
        <h2 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
          <Package size={20} />
          Part Orders to Issue ({partOrders.length})
        </h2>
        {partOrders.length === 0 ? (
          <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No part orders to issue.</div>
        ) : (
          <div className="space-y-3">
            {partOrders.map(order => {
              const totalQty = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
              const totalParts = order.order_items?.length || 0;
              return (
                <div key={order.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-600 font-bold">{order.order_number}</span>
                        <span className="text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Ready to Issue</span>
                      </div>
                      <div className="text-sm mt-1">
                        <p><strong>Customer:</strong> {order.customer_name} ({order.customer_type})</p>
                        <p><strong>FS#:</strong> {order.fs_number}</p>
                        <p><strong>Items:</strong> {totalParts} parts ({totalQty} total units)</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedOrder(order); setSelectedType('part'); }}
                        className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
                      >
                        <Eye size={16} /> View
                      </button>
                      <button
                        onClick={() => handleIssuePartOrder(order.id)}
                        disabled={processing === order.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Issue All
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedType === 'work' ? selectedOrder.work_order_number : selectedOrder.order_number}
              </h2>
              <button onClick={() => { setSelectedOrder(null); setSelectedType(null); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <p><strong>Customer:</strong> {selectedOrder.customer_name} {selectedType === 'work' ? '(Technician)' : `(${selectedOrder.customer_type})`}</p>
              {selectedType === 'work' && (
                <>
                  <p><strong>Technician:</strong> {selectedOrder.assigned_technician}</p>
                  <p><strong>Part Received:</strong> {selectedOrder.part_received || '-'}</p>
                  <p><strong>Diagnosis:</strong> {selectedOrder.diagnosis_notes || '-'}</p>
                  <p><strong>Work Price:</strong> ${selectedOrder.work_price || 0}</p>
                  <p><strong>Part Price:</strong> ${selectedOrder.part_price || 0}</p>
                  <p><strong>Total:</strong> ${selectedOrder.total_price || 0}</p>
                </>
              )}
              <p><strong>FS#:</strong> {selectedOrder.fs_number || 'Not set'}</p>
              <p><strong>Requested By:</strong> {selectedOrder.requested_by || 'Front Desk'}</p>
            </div>

            <h3 className="font-semibold mb-2">Items to Issue</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedType === 'work' ? (
                selectedOrder.work_order_parts?.length > 0 ? (
                  selectedOrder.work_order_parts.map(item => {
                    const part = item.part || {};
                    return (
                      <div key={item.id} className="flex justify-between items-center border-b py-2">
                        <div>
                          <div className="font-medium">{part.item_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{part.item_code || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{part.car_brand || ''} {part.car_model || ''}</div>
                        </div>
                        <div className="text-right">
                          <div>Qty: {item.quantity}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-center py-4">No items to issue.</p>
                )
              ) : (
                selectedOrder.order_items?.length > 0 ? (
                  selectedOrder.order_items.map(item => {
                    const part = item.parts || {};
                    return (
                      <div key={item.id} className="flex justify-between items-center border-b py-2">
                        <div>
                          <div className="font-medium">{part.item_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{part.item_code || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{part.car_brand || ''} {part.car_model || ''}</div>
                        </div>
                        <div className="text-right">
                          <div>Qty: {item.quantity}</div>
                          <div className="text-sm text-gray-500">${item.selling_price_at_time || 0}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-center py-4">No items to issue.</p>
                )
              )}
            </div>

            <button
              onClick={() => {
                if (selectedType === 'work') {
                  handleIssueWorkOrder(selectedOrder.id);
                } else {
                  handleIssuePartOrder(selectedOrder.id);
                }
                setSelectedOrder(null);
                setSelectedType(null);
              }}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg w-full disabled:opacity-50"
              disabled={processing === selectedOrder?.id}
            >
              {processing === selectedOrder?.id ? 'Processing...' : 'Issue All'}
            </button>
            <button
              onClick={() => { setSelectedOrder(null); setSelectedType(null); }}
              className="mt-2 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoreKeeper;