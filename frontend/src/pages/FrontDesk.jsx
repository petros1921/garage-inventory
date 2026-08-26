import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, ShoppingCart, Plus, X, Minus, Wrench, User } from 'lucide-react';

function FrontDesk() {
  const [user, setUser] = useState(null);
  const [parts, setParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Customer type
  const [customerType, setCustomerType] = useState('Buyer');

  // Common fields
  const [customerName, setCustomerName] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Work order specific fields (Technician)
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [woCustomerName, setWoCustomerName] = useState('');
  const [woCustomerPhone, setWoCustomerPhone] = useState('');
  const [woPartReceived, setWoPartReceived] = useState('');
  const [woCustomerPartNumber, setWoCustomerPartNumber] = useState('');
  const [woAssignedTechnician, setWoAssignedTechnician] = useState('');
  const [woDiagnosisNotes, setWoDiagnosisNotes] = useState('');
  const [woNotes, setWoNotes] = useState('');
  const [woSubmitting, setWoSubmitting] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    if (u?.full_name) setRequestedBy(u.full_name);
  }, []);

  // Search parts (returns cards)
  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length < 2) { setParts([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/parts/search?q=${encodeURIComponent(term)}`);
      setParts(res.data.parts || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (part) => {
    if (part.quantity <= 0 || !part.is_selling_price_set) {
      alert('This part is not available for sale');
      return;
    }
    setCart(prev => {
      const existing = prev.find(p => p.part_id === part.id);
      if (existing) {
        return prev.map(p =>
          p.part_id === part.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [...prev, {
        part_id: part.id,
        item_code: part.item_code,
        item_name: part.item_name,
        car_brand: part.car_brand,
        car_model: part.car_model,
        selling_price: part.selling_price || 0,
        quantity: 1
      }];
    });
  };

  const removeFromCart = (partId) => {
    setCart(prev => prev.filter(p => p.part_id !== partId));
  };

  const updateQuantity = (partId, newQty) => {
    if (newQty < 1) {
      removeFromCart(partId);
      return;
    }
    setCart(prev => prev.map(p =>
      p.part_id === partId ? { ...p, quantity: newQty } : p
    ));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);

  const resetBuyerForm = () => {
    setCart([]);
    setCustomerName('');
    setNotes('');
    setShowCart(false);
  };

  const resetWorkOrderForm = () => {
    setWoCustomerName('');
    setWoCustomerPhone('');
    setWoPartReceived('');
    setWoCustomerPartNumber('');
    setWoAssignedTechnician('');
    setWoDiagnosisNotes('');
    setWoNotes('');
    setShowWorkOrderModal(false);
  };

  // Submit External Buyer order
  const handleSubmitBuyer = async () => {
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    if (cart.length === 0) {
      alert('Add at least one item to the order');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_type: 'Buyer',
        requested_by: requestedBy || user?.full_name || 'Front Desk',
        frontdesk_user_id: user?.id,
        items: cart.map(item => ({
          part_id: item.part_id,
          quantity: item.quantity
        })),
        notes: notes || ''
      };
      const res = await api.post('/orders', payload);
      if (res.data.success) {
        alert(`✅ Order ${res.data.order.order_number} sent to Cashier!`);
        resetBuyerForm();
      }
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Submission failed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Technician Work Order
  const handleSubmitWorkOrder = async () => {
    if (!woCustomerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    if (!woPartReceived.trim()) {
      alert('Please describe the part received');
      return;
    }
    if (!woAssignedTechnician.trim()) {
      alert('Please enter the assigned technician name');
      return;
    }
    setWoSubmitting(true);
    try {
      const payload = {
        customer_name: woCustomerName.trim(),
        customer_phone: woCustomerPhone || null,
        part_received: woPartReceived.trim(),
        customer_part_number: woCustomerPartNumber || null,
        assigned_technician: woAssignedTechnician.trim(),
        diagnosis_notes: woDiagnosisNotes || null,
        created_by: user?.id,
        notes: woNotes || null
      };
      const res = await api.post('/work-orders', payload);
      if (res.data.success) {
        alert(`✅ Work order ${res.data.workOrder.work_order_number} created!`);
        resetWorkOrderForm();
        // Refresh parts list if needed
      }
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Creation failed'));
    } finally {
      setWoSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Front Desk</h1>
          <p className="text-sm text-gray-500">
            {customerType === 'Buyer' ? 'Search parts and add to cart' : 'Create a work order for technician'}
          </p>
        </div>
        {customerType === 'Buyer' && (
          <button
            onClick={() => setShowCart(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 relative"
          >
            <ShoppingCart size={18} />
            Cart ({totalItems})
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        )}
        {customerType === 'Technician' && (
          <button
            onClick={() => setShowWorkOrderModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={18} /> New Work Order
          </button>
        )}
      </div>

      {/* Customer Type Toggle */}
      <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700">Customer Type:</span>
          <button
            onClick={() => {
              setCustomerType('Buyer');
              resetBuyerForm();
            }}
            className={`px-4 py-2 rounded-lg transition ${
              customerType === 'Buyer'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <User size={16} className="inline mr-1" /> External Buyer
          </button>
          <button
            onClick={() => {
              setCustomerType('Technician');
              resetWorkOrderForm();
            }}
            className={`px-4 py-2 rounded-lg transition ${
              customerType === 'Technician'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Wrench size={16} className="inline mr-1" /> Technician
          </button>
        </div>
      </div>

      {/* ===== EXTERNAL BUYER ===== */}
      {customerType === 'Buyer' && (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search parts by name, code, brand..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {loading && <div className="text-gray-500">Searching...</div>}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parts.map(p => (
              <div key={p.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between">
                  <span className="font-mono text-blue-600">{p.item_code}</span>
                  <span className="text-sm text-gray-500">{p.category_name}</span>
                </div>
                <h3 className="font-semibold text-lg">{p.item_name}</h3>
                <p className="text-sm text-gray-600">{p.car_brand} {p.car_model}</p>
                <p className="text-sm">Qty: {p.quantity} | Location: {p.location || 'N/A'}</p>
                <p className="text-sm font-medium">Price: ${p.selling_price?.toFixed(2) || 'Not set'}</p>
                {p.quantity > 0 && p.is_selling_price_set ? (
                  <button
                    onClick={() => addToCart(p)}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Plus size={16} /> Add to Cart
                  </button>
                ) : (
                  <p className="text-red-500 text-sm mt-2">Not available</p>
                )}
              </div>
            ))}
          </div>

          {parts.length === 0 && searchTerm.length >= 2 && !loading && (
            <div className="text-center text-gray-500 py-8">No parts found</div>
          )}

          {/* Cart Modal */}
          {showCart && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Order Cart</h2>
                  <button onClick={() => setShowCart(false)} className="text-gray-500 hover:text-gray-700">
                    <X size={24} />
                  </button>
                </div>
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Cart is empty</p>
                ) : (
                  <>
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.part_id} className="flex justify-between items-center border-b pb-2">
                          <div className="flex-1">
                            <div className="font-medium">{item.item_name}</div>
                            <div className="text-sm text-gray-500">{item.item_code} | ${item.selling_price}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => updateQuantity(item.part_id, item.quantity - 1)} className="bg-gray-200 hover:bg-gray-300 w-6 h-6 rounded flex items-center justify-center">-</button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.part_id, item.quantity + 1)} className="bg-gray-200 hover:bg-gray-300 w-6 h-6 rounded flex items-center justify-center">+</button>
                            <button onClick={() => removeFromCart(item.part_id)} className="text-red-500 hover:text-red-700 ml-2">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-3 mb-4 flex justify-between font-semibold">
                      <span>Total: {totalItems} units</span>
                      <span>${totalPrice.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium">Customer Name *</label>
                        <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Requested By</label>
                        <input type="text" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium">Notes</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg resize-none" rows="2" />
                    </div>
                    <div className="flex gap-3 pt-4 border-t">
                      <button
                        onClick={handleSubmitBuyer}
                        disabled={submitting || cart.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
                      >
                        {submitting ? 'Submitting...' : 'Send to Cashier'}
                      </button>
                      <button onClick={() => { setCart([]); setShowCart(false); }} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg">Clear Cart</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== TECHNICIAN WORK ORDER MODAL ===== */}
      {customerType === 'Technician' && showWorkOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">New Work Order</h2>
              <button onClick={() => setShowWorkOrderModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Customer Name *</label>
                <input type="text" required value={woCustomerName} onChange={e => setWoCustomerName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium">Customer Phone</label>
                <input type="text" value={woCustomerPhone} onChange={e => setWoCustomerPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium">Assigned Technician *</label>
                <input type="text" required value={woAssignedTechnician} onChange={e => setWoAssignedTechnician(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. John" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Part Received (Description) *</label>
                <input type="text" required value={woPartReceived} onChange={e => setWoPartReceived(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Starter motor" />
              </div>
              <div>
                <label className="block text-sm font-medium">Customer Part # (optional)</label>
                <input type="text" value={woCustomerPartNumber} onChange={e => setWoCustomerPartNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Initial Diagnosis Notes (optional)</label>
                <textarea value={woDiagnosisNotes} onChange={e => setWoDiagnosisNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg resize-none" rows="2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Notes</label>
                <textarea value={woNotes} onChange={e => setWoNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg resize-none" rows="2" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={handleSubmitWorkOrder}
                disabled={woSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
              >
                {woSubmitting ? 'Saving...' : 'Save Work Order'}
              </button>
              <button
                onClick={() => setShowWorkOrderModal(false)}
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

export default FrontDesk;