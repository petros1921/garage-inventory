import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Receipt, DollarSign } from 'lucide-react';

function PurchasePayments() {
  const [user, setUser] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [pettyCashBalance, setPettyCashBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Purchase orders pending payment (≤50k)
      const purchaseRes = await api.get('/purchase-orders?status=pending_payment');
      setPurchaseOrders(purchaseRes.data.orders || []);

      // Petty cash balance
      const balanceRes = await api.get('/petty-cash/balance');
      setPettyCashBalance(balanceRes.data.balance || 0);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayPurchase = async (id) => {
    setProcessing(id);
    try {
      const res = await api.put(`/purchase-orders/${id}/pay-cashier`, {
        paid_by: user?.id
      });
      if (res.data.success) {
        alert('✅ Purchase order paid from petty cash');
        fetchData();
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
          {purchaseOrders.map(po => (
            <div key={po.id} className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <div className="font-mono text-blue-600">{po.order_number}</div>
                  <div><strong>Item:</strong> {po.item_description}</div>
                  <div><strong>Seller:</strong> {po.seller_name || 'N/A'}</div>
                  <div><strong>Condition:</strong> {po.condition}</div>
                  <div><strong>Total:</strong> ETB {po.total_amount}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handlePayPurchase(po.id)}
                    disabled={processing === po.id || pettyCashBalance < po.total_amount}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    <Receipt size={16} /> Pay (ETB {po.total_amount})
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
    </div>
  );
}

export default PurchasePayments;