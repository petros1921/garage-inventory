import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  FileText, Plus, Search, Trash2, Edit, Printer, X,
  Save, User, Package, DollarSign, Calendar, Eye, Phone, Hash, Percent
} from 'lucide-react';
import EthiopianDate from '../components/EthiopianDate';

function ProformaInvoice() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [proformas, setProformas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedProforma, setSelectedProforma] = useState(null);

  const [form, setForm] = useState({
    customer_name: '',
    customer_tin: '',
    customer_address: '',
    customer_phone: '',
    date: new Date().toISOString().split('T')[0],
    valid_until: '',
    delivery_date: '',
    vat_applied: false,
    notes: '',
    items: [{ description: '', unit: 'PCS', qty: 1, price: 0 }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    fetchProformas();
  }, []);

  const fetchProformas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/proformas');
      setProformas(res.data.proformas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      customer_name: '',
      customer_tin: '',
      customer_address: '',
      customer_phone: '',
      date: new Date().toISOString().split('T')[0],
      valid_until: '',
      delivery_date: '',
      vat_applied: false,
      notes: '',
      items: [{ description: '', unit: 'PCS', qty: 1, price: 0 }],
    });
    setEditingId(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({
      customer_name: p.customer_name || '',
      customer_tin: p.customer_tin || '',
      customer_address: p.customer_address || '',
      customer_phone: p.customer_phone || '',
      date: p.date || new Date().toISOString().split('T')[0],
      valid_until: p.valid_until || '',
      delivery_date: p.delivery_date || '',
      vat_applied: !!p.vat_applied,
      notes: p.notes || '',
      items: p.items && p.items.length ? p.items : [{ description: '', unit: 'PCS', qty: 1, price: 0 }],
    });
    setEditingId(p.id);
    setShowForm(true);
    setSelectedProforma(null);
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { description: '', unit: 'PCS', qty: 1, price: 0 }] }));
  };

  const removeItem = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx, key, value) => {
    setForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, [key]: value } : it),
    }));
  };

  const subtotal = form.items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0);
  const vatAmount = form.vat_applied ? +(subtotal * 0.15).toFixed(2) : 0;
  const grandTotal = +(subtotal + vatAmount).toFixed(2);

  const handleSave = async () => {
    setError('');
    if (!form.customer_name.trim()) {
      setError('Customer name is required');
      return;
    }
    const validItems = form.items.filter(i => i.description.trim() && (parseFloat(i.qty) > 0));
    if (validItems.length === 0) {
      setError('Add at least one item with description and quantity');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, items: validItems, created_by: user?.id };
      const res = editingId
        ? await api.put(`/proformas/${editingId}`, payload)
        : await api.post('/proformas', payload);

      if (res.data.success) {
        setNotification({
          show: true,
          message: editingId ? '✅ Proforma updated' : '✅ Proforma created',
          type: 'success',
        });
        setShowForm(false);
        resetForm();
        fetchProformas();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, number, name) => {
    if (!window.confirm(`Delete proforma ${number} for ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/proformas/${id}`);
      setNotification({ show: true, message: 'Deleted', type: 'success' });
      setSelectedProforma(null);
      fetchProformas();
    } catch (err) {
      setNotification({ show: true, message: err.response?.data?.error || 'Delete failed', type: 'error' });
    }
  };

  const filtered = proformas.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.proforma_number || '').toLowerCase().includes(q) ||
      (p.customer_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={24} className="text-emerald-600" />
            Proforma Invoices
          </h1>
          <p className="text-gray-500 text-sm">Create quotes with editable prices — click any row to view details</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={18} /> New Proforma
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by proforma # or customer name..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No proforma invoices yet. Click "New Proforma" to create one.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Number</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Items</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">VAT</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-emerald-50 cursor-pointer transition"
                  onClick={() => setSelectedProforma(p)}
                >
                  <td className="px-4 py-3 font-mono text-emerald-600 font-semibold whitespace-nowrap">
                    {p.proforma_number}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                    {p.date ? <EthiopianDate date={p.date} /> : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">{(p.items || []).length}</td>
                  <td className="px-4 py-3 text-right">
                    {p.vat_applied ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        +15%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">
                    ETB {(p.total || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedProforma(p); }}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-md"
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/proforma-print/${p.id}`); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-md"
                        title="Print"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-1.5 rounded-md"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.proforma_number, p.customer_name); }}
                        className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-md"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {selectedProforma && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-50 to-teal-50 border-b px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <FileText size={20} className="text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedProforma.proforma_number}</h2>
                  <p className="text-xs text-gray-500">Proforma Invoice Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProforma(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
                <p className="text-xs opacity-90">Grand Total</p>
                <p className="text-3xl font-bold">
                  ETB {(parseFloat(selectedProforma.total) || 0).toFixed(2)}
                </p>
                <div className="flex gap-2 mt-2">
                  {selectedProforma.vat_applied && (
                    <span className="text-xs bg-white bg-opacity-25 px-2.5 py-1 rounded-full font-semibold">
                      VAT (15%) · ETB {(parseFloat(selectedProforma.vat_amount) || 0).toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs bg-white bg-opacity-25 px-2.5 py-1 rounded-full font-semibold capitalize">
                    {selectedProforma.status}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User size={12} /> Customer Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Customer Name</p>
                    <p className="font-medium">{selectedProforma.customer_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash size={11} /> TIN
                    </p>
                    <p className="font-mono font-medium">{selectedProforma.customer_tin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={11} /> Phone
                    </p>
                    <p className="font-medium">{selectedProforma.customer_phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="font-medium">{selectedProforma.customer_address || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Dates
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Date Issued</p>
                    <EthiopianDate date={selectedProforma.date} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valid Until</p>
                    {selectedProforma.valid_until ? (
                      <EthiopianDate date={selectedProforma.valid_until} />
                    ) : <p className="font-medium">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Delivery Date</p>
                    {selectedProforma.delivery_date ? (
                      <EthiopianDate date={selectedProforma.delivery_date} />
                    ) : <p className="font-medium">—</p>}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Package size={12} /> Items ({selectedProforma.items?.length || 0})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 w-8">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">Unit</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 w-24">Price</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600 w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedProforma.items || []).map((it, i) => {
                        const lineTotal = (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0);
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2 text-gray-400 text-center">{i + 1}</td>
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2 text-center text-xs">{it.unit || 'PCS'}</td>
                            <td className="px-3 py-2 text-center">{it.qty}</td>
                            <td className="px-3 py-2 text-right">
                              {(parseFloat(it.price) || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{lineTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr className="border-t">
                        <td colSpan="5" className="px-3 py-2 text-right font-medium text-gray-600">
                          Subtotal
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {(parseFloat(selectedProforma.subtotal) || 0).toFixed(2)}
                        </td>
                      </tr>
                      {selectedProforma.vat_applied && (
                        <tr className="border-t">
                          <td colSpan="5" className="px-3 py-2 text-right font-medium text-blue-700">
                            VAT (15%)
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-blue-700">
                            {(parseFloat(selectedProforma.vat_amount) || 0).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t bg-emerald-50">
                        <td colSpan="5" className="px-3 py-2 text-right font-bold text-emerald-800">
                          Grand Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-800">
                          ETB {(parseFloat(selectedProforma.total) || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedProforma.notes && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{selectedProforma.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-3 flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/proforma-print/${selectedProforma.id}`)}
                className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print
              </button>
              <button
                onClick={() => openEdit(selectedProforma)}
                className="flex-1 min-w-[100px] bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Edit size={16} /> Edit
              </button>
              <button
                onClick={() => handleDelete(selectedProforma.id, selectedProforma.proforma_number, selectedProforma.customer_name)}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <Trash2 size={16} /> Delete
              </button>
              <button
                onClick={() => setSelectedProforma(null)}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FORM MODAL (unchanged) ===== */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-8 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText size={20} className="text-emerald-600" />
                {editingId ? 'Edit Proforma' : 'New Proforma Invoice'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., Abebe Kebede"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer TIN</label>
                <input
                  type="text"
                  value={form.customer_tin}
                  onChange={(e) => setForm({ ...form, customer_tin: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., 0014264781"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input
                  type="text"
                  value={form.customer_address}
                  onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={form.delivery_date}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-1">
                  <Package size={14} /> Items
                </h3>
                <button
                  onClick={addItem}
                  className="text-emerald-600 hover:text-emerald-800 text-sm font-medium flex items-center gap-1"
                >
                  <Plus size={14} /> Add Item
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 w-8">#</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600">Description</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 w-20">Unit</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 w-20">Qty</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-600 w-28">Price</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-600 w-28">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.items.map((item, idx) => {
                      const lineTotal = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0);
                      return (
                        <tr key={idx}>
                          <td className="px-2 py-1 text-gray-400 text-center">{idx + 1}</td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(idx, 'description', e.target.value)}
                              placeholder="Item description"
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-emerald-500 rounded text-sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={item.unit}
                              onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                              className="w-full px-1 py-1 border rounded text-xs"
                            >
                              <option>PCS</option>
                              <option>JOB</option>
                              <option>SET</option>
                              <option>KG</option>
                              <option>LTR</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(idx, 'price', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-2 py-1 text-right font-medium">{lineTotal.toFixed(2)}</td>
                          <td className="px-2 py-1 text-center">
                            {form.items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                                <X size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:bg-blue-100">
                  <input
                    type="checkbox"
                    checked={form.vat_applied}
                    onChange={(e) => setForm({ ...form, vat_applied: e.target.checked })}
                    className="w-5 h-5 rounded text-blue-600"
                  />
                  <div>
                    <p className="font-semibold text-blue-800 text-sm">Add VAT (15%)</p>
                    <p className="text-xs text-blue-600">Total will include VAT</p>
                  </div>
                </label>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Optional notes for the customer..."
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">ETB {subtotal.toFixed(2)}</span>
                </div>
                {form.vat_applied && (
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
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'Saving...' : editingId ? 'Update Proforma' : 'Save Proforma'}
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {notification.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {notification.type === 'success' ? '✅ Success' : '❌ Error'}
            </h2>
            <p className="text-gray-700">{notification.message}</p>
            <button
              onClick={() => setNotification({ show: false, message: '', type: 'success' })}
              className={`mt-4 w-full px-6 py-2 rounded-lg text-white ${
                notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
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

export default ProformaInvoice;