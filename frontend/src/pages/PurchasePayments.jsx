import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Receipt, DollarSign, X, CreditCard, Calendar } from 'lucide-react';

function PurchasePayments() {
  const [user, setUser] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [pettyCashBalance, setPettyCashBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentType, setPaymentType] = useState('cash');
  const [dueDate, setDueDate] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const purchaseRes = await api.get('/purchase-orders?status=pending_payment');
      setPurchaseOrders(purchaseRes.data.orders || []);

      const balanceRes = await api.get('/petty-cash/balance');
      setPettyCashBalance(balanceRes.data.balance || 0);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  };

  const openPaymentModal = (po) => {
    setPaymentOrder(po);
    setPaymentType('cash');
    setDueDate(getDefaultDueDate());
    setModalError('');
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setPaymentType('cash');
    setDueDate('');
    setModalError('');
  };

  const handleSubmitPayment = async () => {
    if (!paymentOrder) return;
    if (paymentType === 'credit' && !dueDate) {
      setModalError('Please select a due date for credit');
      return;
    }

    setProcessing(paymentOrder.id);
    try {
      const payload = {
        paid_by: user?.id,
        payment_type: paymentType
      };
      if (paymentType === 'credit') payload.due_date = dueDate;

      const res = await api.put(`/purchase-orders/${paymentOrder.id}/pay-cashier`, payload);
      if (res.data.success) {
        closePaymentModal();
        fetchData();
      }
    } catch (err) {
      setModalError(err.response?.data?.error || 'Payment failed');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Purchase Payments (Petty Cash)</h1>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <DollarSign size={24} className="text-green-600" />
          <span className="font-medium">Petty Cash Balance:</span>
        </div>
        <span className="text-2xl font-bold text-green-700">ETB {pettyCashBalance.toFixed(2)}</span>
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No purchase orders pending payment.</div>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map(po => {
            const insufficient = pettyCashBalance < po.total_amount;
            return (
              <div key={po.id} className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-mono text-blue-600 font-bold">{po.order_number}</div>
                    <div className="text-sm mt-1">
                      <p><strong>Item:</strong> {po.item_description}</p>
                      <p><strong>Seller:</strong> {po.seller_name || 'N/A'}</p>
                      <p><strong>Condition:</strong> {po.condition}</p>
                      <p><strong>Total:</strong> <span className="font-bold">ETB {po.total_amount}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => openPaymentModal(po)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1"
                    >
                      <Receipt size={16} /> Process Payment
                    </button>
                    {insufficient && (
                      <span className="text-xs text-orange-500">
                        ⚠ Insufficient cash — use Credit instead
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Process Payment</h2>
              <button onClick={closePaymentModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500">Purchase Order</p>
              <p className="font-mono font-bold text-blue-600">{paymentOrder.order_number}</p>
              <p className="text-sm"><strong>Item:</strong> {paymentOrder.item_description}</p>
              <p className="text-sm"><strong>Seller:</strong> {paymentOrder.seller_name || 'N/A'}</p>
              <p className="text-lg font-bold mt-1">Total: ETB {paymentOrder.total_amount}</p>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-3 text-sm">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('cash')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 transition ${
                      paymentType === 'cash'
                        ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign size={16} /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('credit')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 transition ${
                      paymentType === 'credit'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard size={16} /> Credit
                  </button>
                </div>
              </div>

              {paymentType === 'cash' && (
                <div className={`rounded-lg p-3 text-sm ${
                  pettyCashBalance < paymentOrder.total_amount
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-green-50 border border-green-200 text-green-700'
                }`}>
                  <p><strong>Petty Cash:</strong> ETB {pettyCashBalance.toFixed(2)}</p>
                  <p><strong>Required:</strong> ETB {paymentOrder.total_amount}</p>
                  <p className="font-semibold mt-1">
                    {pettyCashBalance < paymentOrder.total_amount
                      ? '❌ Insufficient — select Credit instead'
                      : `✅ After payment: ETB ${(pettyCashBalance - paymentOrder.total_amount).toFixed(2)}`}
                  </p>
                </div>
              )}

              {paymentType === 'credit' && (
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Calendar size={14} /> Due Date *
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    The supplier will be paid by this date. Default: 5 days from today.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t">
              <button
                onClick={handleSubmitPayment}
                disabled={processing === paymentOrder.id || (paymentType === 'cash' && pettyCashBalance < paymentOrder.total_amount)}
                className={`flex-1 text-white px-6 py-2 rounded-lg disabled:opacity-50 ${
                  paymentType === 'credit'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {processing === paymentOrder.id
                  ? 'Processing...'
                  : paymentType === 'credit' ? 'Mark as Credit' : 'Pay Now'}
              </button>
              <button
                onClick={closePaymentModal}
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

export default PurchasePayments;