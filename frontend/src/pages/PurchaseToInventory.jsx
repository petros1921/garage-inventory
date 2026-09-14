import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X } from 'lucide-react';

function PurchaseToInventory() {
  const [user, setUser] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [addPartForm, setAddPartForm] = useState({
    item_name: '',
    category_prefix: '',
    car_brand: '',
    car_model: '',
    item_type: 'Vehicle',
    condition: 'New',
    quantity: 1,
    min_stock: 5,
    row_number: '',
    shelf_number: '',
    bin_number: '',
    supplier_name: '',
    supplier_type: 'Spare Part Shop',
    purchase_price: 0
  });
  const [submittingPart, setSubmittingPart] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchData();
    fetchCategories();
    fetchLocations();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.categories || []);
    } catch (err) { console.error(err); }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.locations || []);
    } catch (err) { console.error(err); }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const purchaseRes = await api.get('/purchase-orders?status=paid&storekeeper_added=false');
      setPurchaseOrders(purchaseRes.data.orders || []);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddPartModal = (purchaseOrder) => {
    setSelectedPurchaseOrder(purchaseOrder);
    setAddPartForm({
      item_name: purchaseOrder.item_description || '',
      category_prefix: '',
      car_brand: purchaseOrder.brand || '',
      car_model: purchaseOrder.model || '',
      item_type: 'Vehicle',
      condition: purchaseOrder.condition || 'New',
      quantity: purchaseOrder.quantity || 1,
      min_stock: 5,
      row_number: '',
      shelf_number: '',
      bin_number: '',
      supplier_name: purchaseOrder.seller_name || '',
      supplier_type: purchaseOrder.seller_type || 'Spare Part Shop',
      purchase_price: purchaseOrder.purchase_price || 0
    });
    setShowAddPartModal(true);
  };

  const handleAddPartSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPurchaseOrder) return;
    setSubmittingPart(true);
    try {
      const partPayload = {
        ...addPartForm,
        quantity: parseInt(addPartForm.quantity),
        purchase_price: parseFloat(addPartForm.purchase_price),
        selling_price: 0
      };
      const partRes = await api.post('/parts', partPayload);
      if (!partRes.data.success) throw new Error(partRes.data.error || 'Part creation failed');

      const newPart = partRes.data.part;

      await api.put(`/purchase-orders/${selectedPurchaseOrder.id}/add-to-inventory`, {
        part_id: newPart.id
      });

      alert('✅ Item added to inventory successfully!');
      setShowAddPartModal(false);
      setSelectedPurchaseOrder(null);
      fetchData();
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingPart(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Add Purchased Items to Inventory</h1>

      {purchaseOrders.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No purchase orders ready to add to inventory.</div>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map(po => (
            <div key={po.id} className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-600 font-bold">{po.order_number}</span>
                    <span className="text-sm bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Paid</span>
                  </div>
                  <div className="text-sm mt-1">
                    <p><strong>Item:</strong> {po.item_description}</p>
                    <p><strong>Brand:</strong> {po.brand || 'N/A'}</p>
                    <p><strong>Model:</strong> {po.model || 'N/A'}</p>
                    <p><strong>Seller:</strong> {po.seller_name || 'N/A'}</p>
                    <p><strong>Condition:</strong> {po.condition}</p>
                    <p><strong>Quantity:</strong> {po.quantity} | Purchase Price: ETB {po.purchase_price}</p>
                  </div>
                </div>
                <button
                  onClick={() => openAddPartModal(po)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm flex items-center gap-1"
                >
                  <Plus size={16} /> Add to Inventory
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddPartModal && selectedPurchaseOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Item to Inventory</h2>
              <button onClick={() => { setShowAddPartModal(false); setSelectedPurchaseOrder(null); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Complete the inventory details for the purchased item. Selling price will be set by the manager.</p>
            <form onSubmit={handleAddPartSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={addPartForm.item_name}
                    onChange={(e) => setAddPartForm({ ...addPartForm, item_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Category *</label>
                  <select
                    required
                    value={addPartForm.category_prefix}
                    onChange={(e) => setAddPartForm({ ...addPartForm, category_prefix: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.prefix}>{c.name} ({c.prefix})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Brand</label>
                  <input
                    type="text"
                    value={addPartForm.car_brand}
                    onChange={(e) => setAddPartForm({ ...addPartForm, car_brand: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Model</label>
                  <input
                    type="text"
                    value={addPartForm.car_model}
                    onChange={(e) => setAddPartForm({ ...addPartForm, car_model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Item Type</label>
                  <select
                    value={addPartForm.item_type}
                    onChange={(e) => setAddPartForm({ ...addPartForm, item_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="Vehicle">Vehicle</option>
                    <option value="Machinery">Machinery</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Condition</label>
                  <select
                    value={addPartForm.condition}
                    onChange={(e) => setAddPartForm({ ...addPartForm, condition: e.target.value })}
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
                    min="1"
                    required
                    value={addPartForm.quantity}
                    onChange={(e) => setAddPartForm({ ...addPartForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Min Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={addPartForm.min_stock}
                    onChange={(e) => setAddPartForm({ ...addPartForm, min_stock: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Purchase Price (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addPartForm.purchase_price}
                    onChange={(e) => setAddPartForm({ ...addPartForm, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Row</label>
                  <input
                    type="text"
                    value={addPartForm.row_number}
                    onChange={(e) => setAddPartForm({ ...addPartForm, row_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Shelf</label>
                  <input
                    type="text"
                    value={addPartForm.shelf_number}
                    onChange={(e) => setAddPartForm({ ...addPartForm, shelf_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Bin</label>
                  <input
                    type="text"
                    value={addPartForm.bin_number}
                    onChange={(e) => setAddPartForm({ ...addPartForm, bin_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Supplier Name</label>
                  <input
                    type="text"
                    value={addPartForm.supplier_name}
                    onChange={(e) => setAddPartForm({ ...addPartForm, supplier_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Supplier Type</label>
                  <select
                    value={addPartForm.supplier_type}
                    onChange={(e) => setAddPartForm({ ...addPartForm, supplier_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="Spare Part Shop">Spare Part Shop</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t">
                <button
                  type="submit"
                  disabled={submittingPart}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
                >
                  {submittingPart ? 'Adding...' : 'Add to Inventory'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddPartModal(false); setSelectedPurchaseOrder(null); }}
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

export default PurchaseToInventory;