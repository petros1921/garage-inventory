import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Receipt as ReceiptIcon, X, Eye, DollarSign, Calendar, CreditCard, Printer, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EthiopianDate from '../components/EthiopianDate';
import EthiopianDatePicker from '../components/EthiopianDatePicker';

function Cashier() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [partOrders, setPartOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [pettyCashBalance, setPettyCashBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [fsNumber, setFsNumber] = useState('');
  const [customerTin, setCustomerTin] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [dueDate, setDueDate] = useState('');
  const [modalError, setModalError] = useState('');
  const [addVat, setAddVat] = useState(false);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  // Notification (replaces alert)
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const notify = (message, type = 'success') => setNotification({ show: true, message, type });
  const closeNotification = () => setNotification({ show: false, message: '', type: 'success' });

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const partRes = await api.get('/orders/status/pending_cashier');
      setPartOrders(partRes.data.orders || []);

      const woRes = await api.get('/work-orders/status/pending_payment');
      setWorkOrders(woRes.data.workOrders || []);

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

  const openPaymentModal = (order, type) => {
    const amount = type === 'part'
      ? (order.order_items || []).reduce((s, i) => s + (i.selling_price_at_time || 0) * (i.quantity || 0), 0)
      : (order.labor_charge || 0) + (order.machine_cost || 0) + (order.total_parts_cost || 0);

    setPaymentOrder({
      id: order.id,
      type,
      amount,
      number: type === 'part' ? order.order_number : order.work_order_number,
      customer: order.customer_name
    });
    setFsNumber('');
    setCustomerTin('');
    setPaymentType('cash');
    setDueDate(getDefaultDueDate());
    setModalError('');
    setAddVat(false);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setFsNumber('');
    setCustomerTin('');
    setPaymentType('cash');
    setDueDate('');
    setModalError('');
    setAddVat(false);
  };

  const subtotal = paymentOrder?.amount || 0;
  const vatAmount = addVat ? +(subtotal * 0.15).toFixed(2) : 0;
  const grandTotal = +(subtotal + vatAmount).toFixed(2);

  const submitPartOrderPayment = async () => {
    if (addVat && !fsNumber.trim()) return setModalError('FS number is required when VAT is applied');
    if (paymentType === 'credit' && !dueDate) return setModalError('Please select a due date for credit');

    setProcessing(paymentOrder.id);
    try {
      const payload = {
        fs_number: addVat ? fsNumber : null,
        cashier_user_id: user?.id,
        payment_type: paymentType,
        vat_applied: addVat,
        customer_tin: customerTin || null
      };
      if (paymentType === 'credit') payload.due_date = dueDate;

      const res = await api.put(`/orders/${paymentOrder.id}/fill-cashier`, payload);
      if (res.data.success) {
        const capturedOrder = paymentOrder;
        closePaymentModal();
        fetchData();
        setSuccessOrder({ ...capturedOrder, vatApplied: addVat, vatAmount });
        setShowSuccessModal(true);
      }
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to process payment');
    } finally {
      setProcessing(null);
    }
  };

  const submitWorkOrderPayment = async () => {
    if (addVat && !fsNumber.trim()) return setModalError('FS number is required when VAT is applied');
    if (paymentType === 'credit' && !dueDate) return setModalError('Please select a due date for credit');

    setProcessing(paymentOrder.id);
    try {
      const payload = {
        fs_number: addVat ? fsNumber : null,
        payment_type: paymentType,
        vat_applied: addVat,
        customer_tin: customerTin || null
      };
      if (paymentType === 'credit') payload.due_date = dueDate;

      const res = await api.put(`/work-orders/${paymentOrder.id}/pay`, payload);
      if (res.data.success) {
        const capturedOrder = paymentOrder;
        closePaymentModal();
        fetchData();
        setSuccessOrder({ ...capturedOrder, vatApplied: addVat, vatAmount });
        setShowSuccessModal(true);
      }
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to process payment');
    } finally {
      setProcessing(null);
    }
  };

  const handleSubmitPayment = () => {
    if (!paymentOrder) return;
    if (paymentOrder.type === 'part') submitPartOrderPayment();
    else submitWorkOrderPayment();
  };

  const handlePrintReceipt = () => {
    if (!successOrder) return;
    const routeType = successOrder.type === 'part' ? 'part' : 'work';
    navigate(`/receipt/${routeType}/${successOrder.id}`);
  };

  const handlePayPurchase = async (id) => {
    setProcessing(id);
    try {
      const res = await api.put(`/purchase-orders/${id}/pay-cashier`, { paid_by: user?.id });
      if (res.data.success) {
        notify('✅ Purchase order paid from petty cash');
        fetchData();
      }
    } catch (err) {
      notify('❌ ' + (err.response?.data?.error || 'Payment failed'), 'error');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cashier Dashboard</h1>

      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 mb-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-200 p-2 rounded-lg">
            <DollarSign size={22} className="text-emerald-700" />
          </div>
          <span className="font-semibold text-emerald-800">Petty Cash Balance</span>
        </div>
        <span className="text-2xl font-bold text-emerald-800">ETB {pettyCashBalance.toFixed(2)}</span>
      </div>

      <RecentPaidOrders onPrint={(type, id) => navigate(`/receipt/${type}/${id}`)} />

      <h2 className="text-xl font-bold mb-4 text-blue-600">Part Orders – Pending Cashier</h2>
      {partOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl">No pending part orders</div>
      ) : (
        <div className="space-y-4">
          {partOrders.map(order => {
            const totalAmount = (order.order_items || []).reduce(
              (s, i) => s + (i.selling_price_at_time || 0) * (i.quantity || 0), 0
            );
            return (
              <div key={order.id} className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-600 font-bold">{order.order_number}</span>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
                    </div>
                    <div className="text-sm mt-1 space-y-0.5">
                      <p><strong>Customer:</strong> {order.customer_name} ({order.customer_type})</p>
                      <p><strong>Requested By:</strong> {order.requested_by}</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">ETB {totalAmount.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">
                        <EthiopianDate date={order.requested_at} includeTime />
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder({ ...order, type: 'part' })}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mt-2"
                    >
                      <Eye size={16} /> View Items ({order.order_items?.length || 0})
                    </button>
                  </div>
                  <button
                    onClick={() => openPaymentModal(order, 'part')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1"
                  >
                    <ReceiptIcon size={16} /> Process Payment
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-xl font-bold mt-8 mb-4 text-purple-600">Work Orders – Pending Payment</h2>
      {workOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No work orders pending payment.</div>
      ) : (
        <div className="space-y-4">
          {workOrders.map(wo => {
            const totalQty = wo.work_order_parts?.reduce((sum, p) => sum + p.quantity, 0) || 0;
            const woSubtotal = (wo.labor_charge || 0) + (wo.machine_cost || 0) + (wo.total_parts_cost || 0);
            return (
              <div key={wo.id} className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-mono text-blue-600 font-bold">{wo.work_order_number}</div>
                    <div className="text-sm mt-1 space-y-0.5">
                      <p><strong>Customer:</strong> {wo.customer_name}</p>
                      <p><strong>Technician:</strong> {wo.assigned_technician || 'N/A'}</p>
                      <p><strong>Items:</strong> {wo.work_order_parts?.length || 0} parts ({totalQty} total)</p>
                      <p className="text-lg font-bold text-gray-800 mt-1">ETB {woSubtotal.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder({ ...wo, type: 'work' })}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mt-2"
                    >
                      <Eye size={16} /> View Items
                    </button>
                  </div>
                  <button
                    onClick={() => openPaymentModal(wo, 'work')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1"
                  >
                    <ReceiptIcon size={16} /> Process Payment
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-xl font-bold mt-8 mb-4 text-orange-600">Purchase Orders – Petty Cash Payment</h2>
      {purchaseOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No purchase orders pending payment.</div>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map(po => (
            <div key={po.id} className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div>
                  <div className="font-mono text-blue-600 font-bold">{po.order_number}</div>
                  <div className="text-sm mt-1 space-y-0.5">
                    <p><strong>Item:</strong> {po.item_description}</p>
                    <p><strong>Seller:</strong> {po.seller_name || 'N/A'}</p>
                    <p><strong>Condition:</strong> {po.condition}</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">ETB {po.total_amount}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handlePayPurchase(po.id)}
                    disabled={processing === po.id || pettyCashBalance < po.total_amount}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    <ReceiptIcon size={16} /> Pay (ETB {po.total_amount})
                  </button>
                  {pettyCashBalance < po.total_amount && (
                    <span className="text-xs text-red-500">Insufficient petty cash</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Process Payment</h2>
              <button onClick={closePaymentModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500">Order</p>
              <p className="font-mono font-bold text-blue-600">{paymentOrder.number}</p>
              <p className="text-sm"><strong>Customer:</strong> {paymentOrder.customer}</p>
            </div>

            <label className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 cursor-pointer hover:bg-blue-100 transition">
              <input
                type="checkbox"
                checked={addVat}
                onChange={(e) => setAddVat(e.target.checked)}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1">
                <p className="font-semibold text-blue-800">Add VAT (15%)</p>
                <p className="text-xs text-blue-600">Enables FS number &amp; printable receipt</p>
              </div>
            </label>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">ETB {subtotal.toFixed(2)}</span>
              </div>
              {addVat && (
                <div className="flex justify-between text-sm py-1 text-blue-700">
                  <span>VAT (15%)</span>
                  <span className="font-medium">+ ETB {vatAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t border-gray-300 mt-1">
                <span className="font-bold">Grand Total</span>
                <span className="font-bold text-lg">ETB {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-3 text-sm">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              {addVat && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    FS Number * <span className="text-xs text-gray-500">(required with VAT)</span>
                  </label>
                  <input
                    type="text"
                    value={fsNumber}
                    onChange={(e) => setFsNumber(e.target.value)}
                    placeholder="Enter FS number"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}

              {addVat && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Purchaser's TIN <span className="text-xs text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerTin}
                    onChange={(e) => setCustomerTin(e.target.value)}
                    placeholder="e.g., 0014264781"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}

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

              {paymentType === 'credit' && (
                <EthiopianDatePicker
                  label="Due Date"
                  value={dueDate}
                  onChange={setDueDate}
                />
              )}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t">
              <button
                onClick={handleSubmitPayment}
                disabled={processing === paymentOrder.id}
                className={`flex-1 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 ${
                  paymentType === 'credit'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {processing === paymentOrder.id
                  ? 'Processing...'
                  : paymentType === 'credit' ? 'Mark as Credit' : 'Complete Payment'}
              </button>
              <button onClick={closePaymentModal} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && successOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ReceiptIcon className="text-green-600" size={32} />
            </div>
            <h2 className="text-xl font-bold mb-1">Payment Recorded</h2>
            <p className="text-sm text-gray-500 mb-4">
              Order <strong>{successOrder.number}</strong> has been processed.
            </p>
            {successOrder.vatApplied && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg py-2 mb-4">
                VAT (15%) applied — receipt available for printing
              </p>
            )}
            <div className="flex gap-3">
              {successOrder.vatApplied && (
                <button
                  onClick={handlePrintReceipt}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium"
                >
                  <Printer size={16} /> Print Receipt
                </button>
              )}
              <button
                onClick={() => { setShowSuccessModal(false); setSuccessOrder(null); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER ITEMS MODAL */}
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
            <p><strong>Customer:</strong> {selectedOrder.customer_name}</p>
            <h3 className="font-semibold mb-2 mt-3">Items</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedOrder.type === 'part' ? (
                selectedOrder.order_items?.map(item => (
                  <div key={item.id} className="flex justify-between border-b py-2">
                    <div>
                      <div className="font-medium">{item.parts?.item_name}</div>
                      <div className="text-sm text-gray-500">{item.parts?.item_code}</div>
                    </div>
                    <div className="text-right">
                      <div>Qty: {item.quantity}</div>
                    </div>
                  </div>
                ))
              ) : (
                selectedOrder.work_order_parts?.map(wp => (
                  <div key={wp.id} className="flex justify-between border-b py-2">
                    <div>
                      <div className="font-medium">{wp.part?.item_name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{wp.part?.item_code || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div>Qty: {wp.quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setSelectedOrder(null)} className="mt-4 bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg w-full">
              Close
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATION MODAL */}
      {notification.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
              notification.type === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle className="text-green-600" size={28} />
              ) : (
                <AlertCircle className="text-red-600" size={28} />
              )}
            </div>
            <h2 className="text-lg font-bold mb-2">
              {notification.type === 'success' ? 'Success' : 'Error'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">{notification.message}</p>
            <button
              onClick={closeNotification}
              className={`w-full px-6 py-2 rounded-lg text-white font-medium ${
                notification.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
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

function RecentPaidOrders({ onPrint }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('vat');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const [ordersRes, workRes] = await Promise.all([
          api.get('/orders/all?limit=100'),
          api.get('/work-orders/with-parts?limit=100'),
        ]);

        const paidOrders = (ordersRes.data.orders || []).filter(o => o.status === 'paid' || o.status === 'completed');
        const paidWork = (workRes.data.workOrders || []).filter(w => w.status === 'paid' || w.status === 'completed');

        const merged = [
          ...paidOrders.map(o => ({
            id: o.id, type: 'part', number: o.order_number, customer: o.customer_name,
            total: (o.order_items || []).reduce((s, i) => s + (i.selling_price_at_time || 0) * (i.quantity || 0), 0),
            vat_applied: o.vat_applied, fs_number: o.fs_number,
            date: o.issued_at || o.paid_at || o.created_at,
          })),
          ...paidWork.map(w => ({
            id: w.id, type: 'work', number: w.work_order_number, customer: w.customer_name,
            total: w.total_amount || 0,
            vat_applied: w.vat_applied, fs_number: w.fs_number,
            date: w.paid_at || w.issued_at || w.created_at,
          })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        setOrders(merged);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = orders.filter(o => {
    if (filter === 'vat' && !o.vat_applied) return false;
    if (filter === 'no-vat' && o.vat_applied) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (o.number || '').toLowerCase().includes(q) || (o.customer || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden mb-6 shadow-sm">
      <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
          <Printer size={18} className="text-emerald-600" />
          Recent Paid Orders — Click to Reprint
        </h2>
        <div className="flex gap-2">
          {[
            { key: 'vat', label: 'With VAT' },
            { key: 'no-vat', label: 'Without VAT' },
            { key: 'all', label: 'All' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                filter === f.key ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order # or customer name..."
          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-6 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-400 text-center py-6 text-sm">No matching orders found.</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {filtered.map(o => (
            <div key={`${o.type}-${o.id}`} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-blue-600 font-bold">{o.number}</span>
                  {o.vat_applied ? (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      VAT · FS#{o.fs_number || '—'}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">No VAT</span>
                  )}
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {o.type === 'part' ? 'Part Order' : 'Work Order'}
                  </span>
                </div>
                <p className="text-sm font-medium mt-0.5">{o.customer}</p>
                <p className="text-xs text-gray-400"><EthiopianDate date={o.date} includeTime /></p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 mb-1">ETB {o.total.toFixed(2)}</p>
                <button
                  onClick={() => onPrint(o.type, o.id)}
                  className={`text-xs px-3 py-1 rounded-md flex items-center gap-1 ml-auto ${
                    o.vat_applied
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  <Printer size={12} /> {o.vat_applied ? 'Receipt' : 'View'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Cashier;