import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Receipt, X, Eye } from 'lucide-react';

function Cashier() {
  const [partOrders, setPartOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fsNumber, setFsNumber] = useState('');

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Part Orders pending cashier
      const partRes = await api.get('/orders/status/pending_cashier');
      setPartOrders(partRes.data.orders || []);

      // Work Orders pending payment (using the enhanced status endpoint)
      const woRes = await api.get('/work-orders/status/pending_payment');
      setWorkOrders(woRes.data.workOrders || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Part Order Handlers ---
  const handleFillCashier = async (orderId) => {
    if (!fsNumber.trim()) {
      alert('Please enter FS number');
      return;
    }
    setProcessing(orderId);
    try {
      const res = await api.put(`/orders/${orderId}/fill-cashier`, {
        fs_number: fsNumber,
        cashier_user_id: user?.id
      });
      if (res.data.success) {
        alert(`✅ Order ${res.data.order.order_number} sent to Manager`);
        setFsNumber('');
        setSelectedOrder(null);
        fetchOrders();
      }
    } catch (err) {
      alert(`❌ ${err.response?.data?.error || 'Failed'}`);
    } finally {
      setProcessing(null);
    }
  };

  // --- Work Order Payment Handler ---
  const handlePayWorkOrder = async (id) => {
    const fsInput = document.getElementById(`fs-wo-${id}`);
    if (!fsInput || !fsInput.value.trim()) {
      alert('Please enter FS number');
      return;
    }
    const fsNumber = fsInput.value.trim();
    setProcessing(id);
    try {
      const res = await api.put(`/work-orders/${id}/pay`, { fs_number: fsNumber });
      if (res.data.success) {
        alert('✅ Work order paid successfully');
        fetchOrders();
      }
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Payment failed'));
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cashier Dashboard</h1>

      {/* ===== PART ORDERS PENDING CASHIER ===== */}
      <h2 className="text-xl font-bold mb-4 text-blue-600">Part Orders – Pending Cashier</h2>
      {partOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No pending part orders</div>
      ) : (
        <div className="space-y-4">
          {partOrders.map(order => (
            <div key={order.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-600 font-bold">{order.order_number}</span>
                    <span className="text-sm bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <div className="text-sm mt-1">
                    <p><strong>Customer:</strong> {order.customer_name} ({order.customer_type})</p>
                    <p><strong>Requested By:</strong> {order.requested_by}</p>
                    <p><strong>Requested:</strong> {new Date(order.requested_at).toLocaleString()}</p>
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={() => setSelectedOrder({ ...order, type: 'part' })}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <Eye size={16} /> View Items ({order.order_items?.length || 0})
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg min-w-[200px]">
                  <div className="text-sm font-medium">Cashier Action</div>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      placeholder="FS Number *"
                      className="w-full px-2 py-1 border rounded text-sm"
                      onChange={(e) => setFsNumber(e.target.value)}
                    />
                    <button
                      onClick={() => handleFillCashier(order.id)}
                      disabled={processing === order.id}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-1 rounded text-sm flex items-center justify-center gap-1"
                    >
                      <Receipt size={16} /> Send to Manager
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== WORK ORDERS PENDING PAYMENT ===== */}
      <h2 className="text-xl font-bold mt-8 mb-4 text-purple-600">Work Orders – Pending Payment</h2>
      {workOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-4">No work orders pending payment.</div>
      ) : (
        <div className="space-y-4">
          {workOrders.map(wo => {
            const totalQty = wo.work_order_parts?.reduce((sum, p) => sum + p.quantity, 0) || 0;
            const totalParts = wo.work_order_parts?.length || 0;
            const totalPrice = wo.total_amount || 0;
            return (
              <div key={wo.id} className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <div className="font-mono text-blue-600">{wo.work_order_number}</div>
                    <div><strong>Customer:</strong> {wo.customer_name}</div>
                    <div><strong>Technician:</strong> {wo.assigned_technician || 'N/A'}</div>
                    <div><strong>Items:</strong> {totalParts} parts ({totalQty} total)</div>
                    <div><strong>Work Price:</strong> ${wo.work_price || 0}</div>
                    <div><strong>Part Price:</strong> ${wo.part_price || 0}</div>
                    <div><strong>Total:</strong> ${totalPrice}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedOrder({ ...wo, type: 'work' })}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm flex items-center gap-1"
                    >
                      <Eye size={16} /> View Items
                    </button>
                    <div className="bg-gray-50 p-3 rounded-lg min-w-[200px]">
                      <div className="text-sm font-medium">Cashier Action</div>
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="FS Number *"
                          className="w-full px-2 py-1 border rounded text-sm"
                          id={`fs-wo-${wo.id}`}
                        />
                        <button
                          onClick={() => handlePayWorkOrder(wo.id)}
                          disabled={processing === wo.id}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-1 rounded text-sm flex items-center justify-center gap-1"
                        >
                          <Receipt size={16} /> Complete Payment
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== ORDER ITEMS MODAL (for both Part and Work orders) ===== */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedOrder.type === 'part' ? selectedOrder.order_number : selectedOrder.work_order_number}
              </h2>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <p><strong>Customer:</strong> {selectedOrder.customer_name}</p>
              {selectedOrder.type === 'part' ? (
                <>
                  <p><strong>Requested By:</strong> {selectedOrder.requested_by}</p>
                  <p><strong>Notes:</strong> {selectedOrder.notes || '-'}</p>
                </>
              ) : (
                <>
                  <p><strong>Technician:</strong> {selectedOrder.assigned_technician}</p>
                  <p><strong>Diagnosis:</strong> {selectedOrder.diagnosis_notes || '-'}</p>
                  <p><strong>Work Price:</strong> ${selectedOrder.work_price || 0}</p>
                  <p><strong>Part Price:</strong> ${selectedOrder.part_price || 0}</p>
                  <p><strong>Total:</strong> ${selectedOrder.total_price || 0}</p>
                </>
              )}
            </div>
            <h3 className="font-semibold mb-2">Items</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedOrder.type === 'part' ? (
                selectedOrder.order_items?.length > 0 ? (
                  selectedOrder.order_items.map(item => {
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
                  })
                ) : (
                  <p className="text-gray-500">No items</p>
                )
              ) : (
                selectedOrder.work_order_parts?.length > 0 ? (
                  selectedOrder.work_order_parts.map(wp => (
                    <div key={wp.id} className="flex justify-between items-center border-b py-2">
                      <div>
                        <div className="font-medium">{wp.part_name || wp.part?.item_name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{wp.part_code || wp.part?.item_code || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{wp.car_brand || ''} {wp.car_model || ''}</div>
                      </div>
                      <div className="text-right">
                        <div>Qty: {wp.quantity}</div>
                        <div className="text-sm text-gray-500">${wp.selling_price || 0}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No items</p>
                )
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

export default Cashier;