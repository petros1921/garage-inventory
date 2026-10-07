import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Search, X, Download, Eye, ShoppingCart, User, Package,
  Calendar, FileText, DollarSign, Hash
} from 'lucide-react';
import { exportToExcel } from '../utils/exportToExcel';
import EthiopianDate from '../components/EthiopianDate';
import { formatEthiopian } from '../utils/ethiopianDate';
import EthiopianDatePicker from '../components/EthiopianDatePicker';

function PurchaseHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      pending_manager: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      pending_payment: 'bg-orange-100 text-orange-700',
      pending_manager_payment: 'bg-red-100 text-red-700',
      paid: 'bg-green-100 text-green-700',
      completed: 'bg-purple-100 text-purple-700',
      credited: 'bg-orange-100 text-orange-700',
      denied: 'bg-red-100 text-red-700',
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (dateFrom) {
      const d = new Date(o.paid_at || o.created_at);
      if (d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = new Date(o.paid_at || o.created_at);
      if (d > new Date(dateTo + 'T23:59:59')) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.item_description?.toLowerCase().includes(q) ||
      o.seller_name?.toLowerCase().includes(q)
    );
  });

  const handleExport = () => {
    if (filtered.length === 0) {
      alert('No data to export. Adjust your filters.');
      return;
    }
    const rows = filtered.map(p => ({
      'PO #': p.order_number || '',
      'Item': p.item_description || '',
      'Seller': p.seller_name || '',
      'Seller Type': p.seller_type || '',
      'Brand': p.brand || '',
      'Model': p.model || '',
      'Condition': p.condition || '',
      'Quantity': p.quantity || 0,
      'Purchase Price (ETB)': +(parseFloat(p.purchase_price) || 0).toFixed(2),
      'Total (ETB)': +(parseFloat(p.total_amount) || 0).toFixed(2),
      'Status': p.status || '',
      'VAT Applied': p.vat_applied ? 'Yes' : 'No',
      'FS Number': p.fs_number || '',
      'VAT Amount (ETB)': p.vat_applied ? +(parseFloat(p.vat_amount) || 0).toFixed(2) : 0,
      'Created (Ethiopian)': p.created_at ? formatEthiopian(p.created_at) : '',
      'Created (Gregorian)': p.created_at ? new Date(p.created_at).toLocaleString() : '',
      'Paid (Ethiopian)': p.paid_at ? formatEthiopian(p.paid_at) : '',
      'Paid (Gregorian)': p.paid_at ? new Date(p.paid_at).toLocaleString() : '',
    }));

    rows.push({
      'PO #': '', 'Item': 'TOTAL', 'Seller': '', 'Seller Type': '', 'Brand': '', 'Model': '',
      'Condition': '', 'Quantity': rows.reduce((s, r) => s + (r['Quantity'] || 0), 0),
      'Purchase Price (ETB)': '',
      'Total (ETB)': +rows.reduce((s, r) => s + (r['Total (ETB)'] || 0), 0).toFixed(2),
      'Status': '', 'VAT Applied': '', 'FS Number': '',
      'VAT Amount (ETB)': +rows.reduce((s, r) => s + (r['VAT Amount (ETB)'] || 0), 0).toFixed(2),
      'Created (Ethiopian)': '', 'Created (Gregorian)': '',
      'Paid (Ethiopian)': '', 'Paid (Gregorian)': '',
    });

    exportToExcel(rows, 'purchase_history', 'Purchase Orders');
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  const statuses = [
    'all', 'pending_manager', 'approved', 'pending_payment',
    'pending_manager_payment', 'paid', 'completed', 'credited', 'denied'
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={24} className="text-orange-600" />
            Purchase History
          </h1>
          <p className="text-gray-500 text-sm">All supplier purchase orders</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={16} /> Export Excel ({filtered.length})
        </button>
      </div>

      {/* Filters with Ethiopian Date Pickers */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search: order #, item, seller..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {statuses.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <EthiopianDatePicker label="From (ከ)" value={dateFrom} onChange={setDateFrom} />
          <EthiopianDatePicker label="To (እስከ)" value={dateTo} onChange={setDateTo} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
          No purchase orders found for the selected filters.
        </div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Order #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Item</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden md:table-cell">Seller</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Qty</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(order => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-4 py-3 font-mono text-blue-600 font-semibold whitespace-nowrap">
                    {order.order_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{order.item_description}</div>
                    {order.brand && (
                      <div className="text-xs text-gray-500">
                        {order.brand}{order.model ? ` · ${order.model}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    {order.seller_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">{order.quantity}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                    ETB {(parseFloat(order.total_amount) || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusBadge(order.status)}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 whitespace-nowrap">
                    <EthiopianDate date={order.created_at} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-md"
                      title="View Details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-50 to-amber-50 border-b px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <ShoppingCart size={20} className="text-orange-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedOrder.order_number}</h2>
                  <p className="text-xs text-gray-500">Purchase Order Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white">
                <p className="text-xs opacity-90">Total Amount</p>
                <p className="text-3xl font-bold">
                  ETB {(parseFloat(selectedOrder.total_amount) || 0).toFixed(2)}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-white bg-opacity-25 px-2.5 py-1 rounded-full font-semibold capitalize">
                    {selectedOrder.status.replace(/_/g, ' ')}
                  </span>
                  {selectedOrder.vat_applied && (
                    <span className="text-xs bg-white bg-opacity-25 px-2.5 py-1 rounded-full font-semibold">
                      VAT 15% · FS#{selectedOrder.fs_number || '—'}
                    </span>
                  )}
                </div>
              </div>

              {selectedOrder.image_url && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item Photo</h3>
                  <a href={selectedOrder.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={selectedOrder.image_url} alt="Item" className="w-full h-56 object-cover rounded-lg border hover:opacity-90" />
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User size={12} /> Seller Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Seller Name</p>
                    <p className="font-medium">{selectedOrder.seller_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Seller Type</p>
                    <p className="font-medium">{selectedOrder.seller_type || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Package size={12} /> Item Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="font-medium">{selectedOrder.item_description || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Brand</p>
                    <p className="font-medium">{selectedOrder.brand || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Model</p>
                    <p className="font-medium">{selectedOrder.model || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Condition</p>
                    <p className="font-medium">{selectedOrder.condition || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="font-medium">{selectedOrder.quantity || 0}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <DollarSign size={12} /> Pricing
                </h3>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unit Price</span>
                    <span className="font-medium">ETB {(parseFloat(selectedOrder.purchase_price) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity</span>
                    <span className="font-medium">{selectedOrder.quantity}</span>
                  </div>
                  {selectedOrder.vat_applied && (
                    <div className="flex justify-between text-orange-700">
                      <span>VAT (15%)</span>
                      <span className="font-medium">+ ETB {(parseFloat(selectedOrder.vat_amount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold text-orange-800">Grand Total</span>
                    <span className="font-bold text-orange-800 text-lg">
                      ETB {(parseFloat(selectedOrder.total_amount) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {(selectedOrder.payment_method || selectedOrder.receipt_no) && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Hash size={12} /> Payment Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {selectedOrder.payment_method && (
                      <div>
                        <p className="text-xs text-gray-500">Payment Method</p>
                        <p className="font-medium">{selectedOrder.payment_method}</p>
                      </div>
                    )}
                    {selectedOrder.receipt_no && (
                      <div>
                        <p className="text-xs text-gray-500">Receipt #</p>
                        <p className="font-mono font-medium">{selectedOrder.receipt_no}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Timeline
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <EthiopianDate date={selectedOrder.created_at} includeTime />
                  </div>
                  {selectedOrder.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Approved</span>
                      <EthiopianDate date={selectedOrder.approved_at} includeTime />
                    </div>
                  )}
                  {selectedOrder.paid_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid</span>
                      <EthiopianDate date={selectedOrder.paid_at} includeTime />
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText size={12} /> Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurchaseHistory;