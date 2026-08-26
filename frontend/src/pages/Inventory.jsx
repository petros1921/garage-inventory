import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Plus, AlertCircle, Edit, X, Trash2 } from 'lucide-react';

function Inventory() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [user, setUser] = useState(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockPart, setRestockPart] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState(1);
  const [restocking, setRestocking] = useState(false);

  // --- Edit Modal ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [editFormData, setEditFormData] = useState({
    item_name: '', category_prefix: '', car_brand: '', car_model: '',
    item_type: 'Vehicle', condition: 'New', quantity: 0, min_stock: 5,
    row_number: '', shelf_number: '', bin_number: '',
    supplier_name: '', supplier_type: 'Spare Part Shop',
    purchase_price: 0, selling_price: 0
  });
  const [editing, setEditing] = useState(false);

  // --- Delete Modal ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePartId, setDeletePartId] = useState(null);
  const [deletePartName, setDeletePartName] = useState('');

  // --- Modal States for Notifications etc. ---
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  const [showSetPriceModal, setShowSetPriceModal] = useState(false);
  const [setPricePartId, setSetPricePartId] = useState(null);
  const [setPriceItemName, setSetPriceItemName] = useState('');
  const [setPriceValue, setSetPriceValue] = useState(0);

  const [showAddPartSuccess, setShowAddPartSuccess] = useState(false);
  const [addPartCode, setAddPartCode] = useState('');

  const [formData, setFormData] = useState({
    item_name: '', category_prefix: '', car_brand: '', car_model: '',
    item_type: 'Vehicle', condition: 'New', quantity: 0, min_stock: 5,
    row_number: '', shelf_number: '', bin_number: '',
    supplier_name: '', supplier_type: 'Spare Part Shop',
    purchase_price: 0
  });

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchParts();
    fetchCategories();
    fetchLocations();
  }, []);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/parts');
      setParts(res.data.parts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  // --- Modal Functions ---
  const openNotification = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
  };
  const closeNotification = () => setShowNotification(false);

  const openSetPriceModal = (partId, itemName, currentPrice) => {
    setSetPricePartId(partId);
    setSetPriceItemName(itemName);
    setSetPriceValue(currentPrice !== undefined && currentPrice !== null ? currentPrice : 0);
    setShowSetPriceModal(true);
  };

  const handleSetPriceSubmit = async () => {
    if (!setPricePartId) return;
    if (isNaN(setPriceValue) || setPriceValue < 0) {
      openNotification('Please enter a valid price', 'error');
      return;
    }
    try {
      await api.put(`/parts/${setPricePartId}/set-selling-price`, { selling_price: parseFloat(setPriceValue) });
      openNotification('✅ Selling price updated successfully!', 'success');
      setShowSetPriceModal(false);
      setSetPricePartId(null);
      fetchParts();
    } catch (err) {
      openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // --- Handlers ---
  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length < 2) { fetchParts(); return; }
    try {
      const res = await api.get(`/parts/search?q=${encodeURIComponent(term)}`);
      setParts(res.data.parts || []);
    } catch (err) { console.error(err); }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parts', formData);
      if (res.data.success) {
        setAddPartCode(res.data.item_code);
        setShowAddPartSuccess(true);
        setShowModal(false);
        setFormData({
          item_name: '', category_prefix: '', car_brand: '', car_model: '',
          item_type: 'Vehicle', condition: 'New', quantity: 0, min_stock: 5,
          row_number: '', shelf_number: '', bin_number: '',
          supplier_name: '', supplier_type: 'Spare Part Shop',
          purchase_price: 0
        });
        fetchParts();
      }
    } catch (err) {
      openNotification(`❌ ${err.response?.data?.error || 'Failed to add part'}`, 'error');
    }
  };

  const getStockStatus = (qty, min) => {
    if (qty === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-100' };
    if (qty <= min) return { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-100' };
    return { label: 'In Stock', color: 'text-green-600 bg-green-100' };
  };

  const handleRestock = async () => {
    setRestocking(true);
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      const res = await api.put(`/parts/${restockPart.id}/restock`, {
        quantity_to_add: parseInt(restockQuantity),
        restock_by: userData?.full_name || 'Admin'
      });
      if (res.data.success) {
        openNotification(`✅ Restocked ${restockQuantity} units. New qty: ${res.data.part.quantity}`, 'success');
        setShowRestockModal(false);
        setRestockPart(null);
        setRestockQuantity(1);
        fetchParts();
      }
    } catch (err) {
      openNotification(`❌ ${err.response?.data?.error || 'Failed to restock'}`, 'error');
    } finally {
      setRestocking(false);
    }
  };

  const handleSetPriceClick = (partId, itemName, currentPrice) => {
    openSetPriceModal(partId, itemName, currentPrice);
  };

  // --- Edit Handlers ---
  const openEditModal = (part) => {
    setEditPart(part);
    setEditFormData({
      item_name: part.item_name || '',
      category_prefix: part.category_prefix || '',
      car_brand: part.car_brand || '',
      car_model: part.car_model || '',
      item_type: part.item_type || 'Vehicle',
      condition: part.condition || 'New',
      quantity: part.quantity || 0,
      min_stock: part.min_stock || 5,
      row_number: part.row_number || '',
      shelf_number: part.shelf_number || '',
      bin_number: part.bin_number || '',
      supplier_name: part.supplier_name || '',
      supplier_type: part.supplier_type || 'Spare Part Shop',
      purchase_price: part.purchase_price || 0,
      selling_price: part.selling_price || 0
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editPart) return;
    setEditing(true);
    try {
      const payload = {
        item_name: editFormData.item_name,
        category_prefix: editFormData.category_prefix,
        car_brand: editFormData.car_brand,
        car_model: editFormData.car_model,
        item_type: editFormData.item_type,
        condition: editFormData.condition,
        quantity: parseInt(editFormData.quantity) || 0,
        min_stock: parseInt(editFormData.min_stock) || 5,
        row_number: editFormData.row_number,
        shelf_number: editFormData.shelf_number,
        bin_number: editFormData.bin_number,
        supplier_name: editFormData.supplier_name,
        supplier_type: editFormData.supplier_type,
        purchase_price: parseFloat(editFormData.purchase_price) || 0,
        selling_price: parseFloat(editFormData.selling_price) || 0
      };
      await api.put(`/parts/${editPart.id}`, payload);
      openNotification('✅ Part updated successfully!', 'success');
      setShowEditModal(false);
      setEditPart(null);
      fetchParts();
    } catch (err) {
      openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setEditing(false);
    }
  };

  // --- Delete Handlers ---
  const openDeleteModal = (partId, partName) => {
    setDeletePartId(partId);
    setDeletePartName(partName);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletePartId) return;
    try {
      await api.delete(`/parts/${deletePartId}`);
      openNotification(`✅ Part "${deletePartName}" deleted successfully!`, 'success');
      setShowDeleteModal(false);
      setDeletePartId(null);
      setDeletePartName('');
      fetchParts();
    } catch (err) {
      openNotification('❌ Error: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // --- Render helpers ---
  const isManager = user?.role === 'manager';
  const isStoreKeeper = user?.role === 'storekeeper';

  const filtered = parts.filter(p =>
    p.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.car_brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.car_model?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-gray-500">{parts.length} parts</p>
        </div>
        {(isManager || isStoreKeeper) && (
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={18} /> Add Part
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={handleSearch}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Brand</th>
              <th className="px-4 py-3 text-left hidden lg:table-cell">Model</th>
              <th className="px-4 py-3 text-left">Condition</th>
              <th className="px-4 py-3 text-left">Qty</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Location</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Purchase</th>
              <th className="px-4 py-3 text-left">Sell</th>
              {(isManager || isStoreKeeper) && <th className="px-4 py-3 text-left">Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const status = getStockStatus(p.quantity, p.min_stock);
              return (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-blue-600">{p.item_code}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{p.item_name}</div>
                    <div className="text-xs text-gray-400">{p.category_name}</div>
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">{p.car_brand || '-'}</td>
                  <td className="px-4 py-2 hidden lg:table-cell">{p.car_model || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.condition === 'New' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {p.condition || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-bold">{p.quantity}</td>
                  <td className="px-4 py-2 hidden sm:table-cell">{p.location || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-2">${p.purchase_price?.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {p.is_selling_price_set ? `$${p.selling_price?.toFixed(2)}` : 'Not set'}
                  </td>
                  {(isManager || isStoreKeeper) && (
                    <td className="px-4 py-2">
                      {/* Store Keeper: Restock */}
                      {isStoreKeeper && (
                        <button
                          onClick={() => { setRestockPart(p); setShowRestockModal(true); }}
                          className="bg-green-500 text-white text-xs px-2 py-1 rounded mr-1"
                        >
                          Restock
                        </button>
                      )}
                      {/* Manager: Edit, Delete, Set Price */}
                      {isManager && (
                        <>
                          <button
                            onClick={() => openEditModal(p)}
                            className="bg-blue-500 text-white text-xs px-2 py-1 rounded mr-1"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => openDeleteModal(p.id, p.item_name)}
                            className="bg-red-500 text-white text-xs px-2 py-1 rounded mr-1"
                          >
                            <Trash2 size={12} />
                          </button>
                          <button
                            onClick={() => handleSetPriceClick(p.id, p.item_name, p.selling_price)}
                            className="bg-purple-500 text-white text-xs px-2 py-1 rounded"
                          >
                            {p.is_selling_price_set ? 'Edit Price' : 'Set Price'}
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========== ADD PART MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add New Part</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddPart}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Same as before */}
                <div>
                  <label className="block text-sm font-medium">Item Name *</label>
                  <input type="text" required value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Category *</label>
                  <select required value={formData.category_prefix} onChange={e => setFormData({...formData, category_prefix: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select</option>
                    {categories.map(c => <option key={c.id} value={c.prefix}>{c.name} ({c.prefix})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Brand</label>
                  <input type="text" value={formData.car_brand} onChange={e => setFormData({...formData, car_brand: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Model</label>
                  <input type="text" value={formData.car_model} onChange={e => setFormData({...formData, car_model: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Quantity *</label>
                  <input type="number" required min="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)||0})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Min Stock</label>
                  <input type="number" min="0" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseInt(e.target.value)||5})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Purchase Price ($)</label>
                  <input type="number" min="0" step="0.01" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: parseFloat(e.target.value)||0})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Condition</label>
                  <select value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Row</label>
                  <input type="text" value={formData.row_number} onChange={e => setFormData({...formData, row_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Shelf</label>
                  <input type="text" value={formData.shelf_number} onChange={e => setFormData({...formData, shelf_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Bin</label>
                  <input type="text" value={formData.bin_number} onChange={e => setFormData({...formData, bin_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Supplier Name</label>
                  <input type="text" value={formData.supplier_name} onChange={e => setFormData({...formData, supplier_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Supplier Type</label>
                  <select value={formData.supplier_type} onChange={e => setFormData({...formData, supplier_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="Spare Part Shop">Spare Part Shop</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg flex-1">Add Part</button>
                <button type="button" onClick={() => setShowModal(false)} className="bg-gray-200 px-6 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== EDIT MODAL ========== */}
      {showEditModal && editPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Part: {editPart.item_code}</h2>
              <button onClick={() => { setShowEditModal(false); setEditPart(null); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Item Name *</label>
                  <input type="text" required value={editFormData.item_name} onChange={e => setEditFormData({...editFormData, item_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Category *</label>
                  <select required value={editFormData.category_prefix} onChange={e => setEditFormData({...editFormData, category_prefix: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select</option>
                    {categories.map(c => <option key={c.id} value={c.prefix}>{c.name} ({c.prefix})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Brand</label>
                  <input type="text" value={editFormData.car_brand} onChange={e => setEditFormData({...editFormData, car_brand: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Model</label>
                  <input type="text" value={editFormData.car_model} onChange={e => setEditFormData({...editFormData, car_model: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Quantity *</label>
                  <input type="number" required min="0" value={editFormData.quantity} onChange={e => setEditFormData({...editFormData, quantity: parseInt(e.target.value)||0})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Min Stock</label>
                  <input type="number" min="0" value={editFormData.min_stock} onChange={e => setEditFormData({...editFormData, min_stock: parseInt(e.target.value)||5})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Purchase Price ($)</label>
                  <input type="number" min="0" step="0.01" value={editFormData.purchase_price} onChange={e => setEditFormData({...editFormData, purchase_price: parseFloat(e.target.value)||0})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Selling Price ($)</label>
                  <input type="number" min="0" step="0.01" value={editFormData.selling_price} onChange={e => setEditFormData({...editFormData, selling_price: parseFloat(e.target.value)||0})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Condition</label>
                  <select value={editFormData.condition} onChange={e => setEditFormData({...editFormData, condition: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Item Type</label>
                  <select value={editFormData.item_type} onChange={e => setEditFormData({...editFormData, item_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="Vehicle">Vehicle</option>
                    <option value="Machinery">Machinery</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Row</label>
                  <input type="text" value={editFormData.row_number} onChange={e => setEditFormData({...editFormData, row_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Shelf</label>
                  <input type="text" value={editFormData.shelf_number} onChange={e => setEditFormData({...editFormData, shelf_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Bin</label>
                  <input type="text" value={editFormData.bin_number} onChange={e => setEditFormData({...editFormData, bin_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Supplier Name</label>
                  <input type="text" value={editFormData.supplier_name} onChange={e => setEditFormData({...editFormData, supplier_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Supplier Type</label>
                  <select value={editFormData.supplier_type} onChange={e => setEditFormData({...editFormData, supplier_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="Spare Part Shop">Spare Part Shop</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button type="submit" disabled={editing} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex-1">
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setShowEditModal(false); setEditPart(null); }} className="bg-gray-200 px-6 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== DELETE CONFIRM MODAL ========== */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-600">Confirm Delete</h2>
              <button onClick={() => { setShowDeleteModal(false); setDeletePartId(null); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700">
              Are you sure you want to delete <strong>"{deletePartName}"</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex-1"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePartId(null); }}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== RESTOCK MODAL ========== */}
      {showRestockModal && restockPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Restock {restockPart.item_name}</h2>
              <button onClick={() => { setShowRestockModal(false); setRestockPart(null); setRestockQuantity(1); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p>Current quantity: <strong>{restockPart.quantity}</strong></p>
            <div className="mt-3">
              <label className="block text-sm font-medium">Quantity to Add</label>
              <input
                type="number"
                min="1"
                value={restockQuantity}
                onChange={e => setRestockQuantity(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none mt-1"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                New quantity: {parseInt(restockPart.quantity) + parseInt(restockQuantity || 0)}
              </p>
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleRestock}
                disabled={restocking}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
              >
                {restocking ? 'Restocking...' : 'Confirm Restock'}
              </button>
              <button
                onClick={() => { setShowRestockModal(false); setRestockPart(null); setRestockQuantity(1); }}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== SET PRICE MODAL ========== */}
      {showSetPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Set Selling Price</h2>
              <button onClick={() => setShowSetPriceModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 mb-2">Set the selling price for:</p>
            <p className="font-semibold text-lg">{setPriceItemName}</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={setPriceValue}
                onChange={(e) => setSetPriceValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={handleSetPriceSubmit}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex-1"
              >
                Save Price
              </button>
              <button
                onClick={() => setShowSetPriceModal(false)}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD PART SUCCESS ========== */}
      {showAddPartSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-green-600">✅ Part Added!</h2>
              <button onClick={() => setShowAddPartSuccess(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700">Part code: <span className="font-mono text-blue-600 font-bold">{addPartCode}</span></p>
            <p className="text-sm text-gray-500 mt-1">The part has been added to your inventory.</p>
            <button
              onClick={() => setShowAddPartSuccess(false)}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ========== NOTIFICATION MODAL ========== */}
      {showNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {notificationType === 'success' ? '✅ Success' : '❌ Error'}
              </h2>
              <button onClick={closeNotification} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700">{notificationMessage}</p>
            <button
              onClick={closeNotification}
              className={`mt-4 w-full px-6 py-2 rounded-lg text-white ${
                notificationType === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
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

export default Inventory;