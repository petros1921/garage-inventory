import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  History, Search, X, Receipt, Printer, Download, Eye,
  Phone, Wrench, Package, User, Calendar, FileText
} from 'lucide-react';
import { exportToExcel } from '../utils/exportToExcel';
import EthiopianDate from '../components/EthiopianDate';
import { formatEthiopian } from '../utils/ethiopianDate';
import EthiopianDatePicker from '../components/EthiopianDatePicker';

function WorkHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/work-orders/with-parts');
      const filtered = (res.data.workOrders || []).filter(
        wo => wo.status === 'paid' || wo.status === 'completed'
      );
      setHistory(filtered);
    } catch (err) {
      console.error('Error fetching work history:', err);
    } finally {
      setLoading(false);
    }
  };

  const goToReceipt = (workOrderId) => {
    window.open(`/receipt/work/${workOrderId}`, '_blank');
  };

  const getStatusBadge = (status) => {
    const classes = {
      pending_diagnosis: 'bg-yellow-100 text-yellow-600',
      diagnosed: 'bg-blue-100 text-blue-600',
      fixing: 'bg-purple-100 text-purple-600',
      pending_manager: 'bg-orange-100 text-orange-600',
      pending_storekeeper: 'bg-indigo-100 text-indigo-600',
      completed: 'bg-green-100 text-green-600',
      pending_payment: 'bg-pink-100 text-pink-600',
      paid: 'bg-gray-100 text-gray-600',
      denied: 'bg-red-100 text-red-600',
      credited: 'bg-orange-100 text-orange-700',
      archived: 'bg-gray-200 text-gray-500',
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  const filtered = history.filter(h => {
    if (dateFrom) {
      const d = new Date(h.issued_at || h.paid_at || h.created_at);
      if (d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = new Date(h.issued_at || h.paid_at || h.created_at);
      if (d > new Date(dateTo + 'T23:59:59')) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      h.customer_name?.toLowerCase().includes(q) ||
      h.work_order_number?.toLowerCase().includes(q) ||
      h.assigned_technician?.toLowerCase().includes(q) ||
      h.part_received?.toLowerCase().includes(q)
    );
  });

  const handleExport = () => {
    if (filtered.length === 0) {
      alert('No data to export. Adjust your filters.');
      return;
    }
    const rows = filtered.map(w => ({
      'WO #': w.work_order_number || '',
      'Customer': w.customer_name || '',
      'Phone': w.customer_phone || '',
      'Part Received': w.part_received || '',
      'Customer Part #': w.customer_part_number || '',
      'Technician': w.assigned_technician || '',
      'Diagnosis': w.diagnosis_notes || '',
      'Status': w.status || '',
      'Parts Used': (w.work_order_parts || []).map(p => `${p.part?.item_name} x${p.quantity}`).join(', '),
      'Work Price (ETB)': +(w.work_price || 0).toFixed(2),
      'Machine Cost (ETB)': +(w.machine_price || w.machine_cost || 0).toFixed(2),
      'Part Price (ETB)': +(w.part_price || 0).toFixed(2),
      'Subtotal (ETB)': +(w.subtotal || 0).toFixed(2),
      'VAT Applied': w.vat_applied ? 'Yes' : 'No',
      'FS Number': w.fs_number || '',
      'VAT Amount (ETB)': w.vat_applied ? +(w.vat_amount || 0).toFixed(2) : 0,
      'Total (ETB)': +(w.total_amount || 0).toFixed(2),
      'Created (Ethiopian)': w.created_at ? formatEthiopian(w.created_at) : '',
      'Created (Gregorian)': w.created_at ? new Date(w.created_at).toLocaleString() : '',
      'Paid (Ethiopian)': w.paid_at ? formatEthiopian(w.paid_at) : '',
      'Paid (Gregorian)': w.paid_at ? new Date(w.paid_at).toLocaleString() : '',
    }));

    rows.push({
      'WO #': '', 'Customer': '', 'Phone': '', 'Part Received': '', 'Customer Part #': '',
      'Technician': '', 'Diagnosis': '', 'Status': '', 'Parts Used': 'TOTAL',
      'Work Price (ETB)': +rows.reduce((s, r) => s + r['Work Price (ETB)'], 0).toFixed(2),
      'Machine Cost (ETB)': +rows.reduce((s, r) => s + r['Machine Cost (ETB)'], 0).toFixed(2),
      'Part Price (ETB)': +rows.reduce((s, r) => s + r['Part Price (ETB)'], 0).toFixed(2),
      'Subtotal (ETB)': +rows.reduce((s, r) => s + r['Subtotal (ETB)'], 0).toFixed(2),
      'VAT Applied': '', 'FS Number': '',
      'VAT Amount (ETB)': +rows.reduce((s, r) => s + r['VAT Amount (ETB)'], 0).toFixed(2),
      'Total (ETB)': +rows.reduce((s, r) => s + r['Total (ETB)'], 0).toFixed(2),
      'Created (Ethiopian)': '', 'Created (Gregorian)': '',
      'Paid (Ethiopian)': '', 'Paid (Gregorian)': '',
    });

    exportToExcel(rows, 'work_history', 'Work Orders');
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History size={24} className="text-blue-600" />
            Work History
          </h1>
          <p className="text-gray-500 text-sm">All paid & completed work orders</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search: customer, WO#, technician, part..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <EthiopianDatePicker label="From (ከ)" value={dateFrom} onChange={setDateFrom} />
          <EthiopianDatePicker label="To (እስከ)" value={dateTo} onChange={setDateTo} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
          No work history found for the selected filters.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Order #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden md:table-cell">Part Received</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 hidden lg:table-cell">Technician</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Parts</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(h => (
                <tr
                  key={h.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedWorkOrder(h)}
                >
                  <td className="px-4 py-3 font-mono text-blue-600 font-semibold whitespace-nowrap">
                    {h.work_order_number}
                  </td>
                  <td className="px-4 py-3">{h.customer_name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">{h.part_received || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{h.assigned_technician || '—'}</td>
                  <td className="px-4 py-3 text-center">{h.work_order_parts?.length || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                    ETB {(parseFloat(h.total_amount) || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedWorkOrder(h); }}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-md"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                      {h.vat_applied && (
                        <button
                          onClick={(e) => { e.stopPropagation(); goToReceipt(h.id); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-md"
                          title="View Receipt"
                        >
                          <Receipt size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Wrench size={20} className="text-blue-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedWorkOrder.work_order_number}
                  </h2>
                  <p className="text-xs text-gray-500">Work Order Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorkOrder(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
                <p className="text-xs opacity-90">Total Amount</p>
                <p className="text-3xl font-bold">
                  ETB {(parseFloat(selectedWorkOrder.total_amount) || 0).toFixed(2)}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold bg-white bg-opacity-25 capitalize`}>
                    {selectedWorkOrder.status}
                  </span>
                  {selectedWorkOrder.vat_applied && (
                    <span className="text-xs bg-white bg-opacity-25 px-2.5 py-1 rounded-full font-semibold">
                      VAT 15% · FS#{selectedWorkOrder.fs_number || '—'}
                    </span>
                  )}
                </div>
              </div>

              {(selectedWorkOrder.received_image_url || selectedWorkOrder.delivered_image_url) && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📷 Photos</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedWorkOrder.received_image_url && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">📥 Received</p>
                        <a href={selectedWorkOrder.received_image_url} target="_blank" rel="noopener noreferrer">
                          <img src={selectedWorkOrder.received_image_url} alt="Received" className="w-full h-40 object-cover rounded-lg border hover:opacity-90" />
                        </a>
                      </div>
                    )}
                    {selectedWorkOrder.delivered_image_url && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">📤 Delivered</p>
                        <a href={selectedWorkOrder.delivered_image_url} target="_blank" rel="noopener noreferrer">
                          <img src={selectedWorkOrder.delivered_image_url} alt="Delivered" className="w-full h-40 object-cover rounded-lg border hover:opacity-90" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User size={12} /> Customer Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>
                    <p className="font-medium">{selectedWorkOrder.customer_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={11} /> Phone
                    </p>
                    <p className="font-medium">{selectedWorkOrder.customer_phone || 'Not provided'}</p>
                  </div>
                  {selectedWorkOrder.customer_tin && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">Customer TIN</p>
                      <p className="font-mono font-medium">{selectedWorkOrder.customer_tin}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Wrench size={12} /> Service Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Part Received</p>
                    <p className="font-medium">{selectedWorkOrder.part_received || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Customer Part #</p>
                    <p className="font-mono font-medium">{selectedWorkOrder.customer_part_number || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Technician</p>
                    <p className="font-medium">{selectedWorkOrder.assigned_technician || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Diagnosis Notes</p>
                    <p className="text-sm">{selectedWorkOrder.diagnosis_notes || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Package size={12} /> Parts Used ({selectedWorkOrder.work_order_parts?.length || 0})
                </h3>
                {selectedWorkOrder.work_order_parts?.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Part</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Code</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600">Qty</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkOrder.work_order_parts.map(wp => {
                          const price = wp.selling_price_at_time || wp.selling_price || wp.part?.selling_price || 0;
                          return (
                            <tr key={wp.id} className="border-b last:border-0">
                              <td className="px-3 py-2">{wp.part?.item_name || 'Unknown'}</td>
                              <td className="px-3 py-2 font-mono text-blue-600 text-xs">{wp.part?.item_code || 'N/A'}</td>
                              <td className="px-3 py-2 text-center">{wp.quantity}</td>
                              <td className="px-3 py-2 text-right">ETB {(price * wp.quantity).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">No parts used.</p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText size={12} /> Pricing
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Work Price (Labor)</span>
                    <span className="font-medium">ETB {(parseFloat(selectedWorkOrder.work_price) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Machine Cost</span>
                    <span className="font-medium">ETB {(parseFloat(selectedWorkOrder.machine_price) || parseFloat(selectedWorkOrder.machine_cost) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Parts Cost</span>
                    <span className="font-medium">ETB {(parseFloat(selectedWorkOrder.part_price) || 0).toFixed(2)}</span>
                  </div>
                  {selectedWorkOrder.vat_applied && (
                    <div className="flex justify-between text-blue-700">
                      <span>VAT (15%)</span>
                      <span className="font-medium">+ ETB {(parseFloat(selectedWorkOrder.vat_amount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold text-blue-800">Grand Total</span>
                    <span className="font-bold text-blue-800 text-lg">
                      ETB {(parseFloat(selectedWorkOrder.total_amount) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Timeline
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <EthiopianDate date={selectedWorkOrder.created_at} includeTime />
                  </div>
                  {selectedWorkOrder.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Approved</span>
                      <EthiopianDate date={selectedWorkOrder.approved_at} includeTime />
                    </div>
                  )}
                  {selectedWorkOrder.issued_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Issued</span>
                      <EthiopianDate date={selectedWorkOrder.issued_at} includeTime />
                    </div>
                  )}
                  {selectedWorkOrder.paid_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paid</span>
                      <EthiopianDate date={selectedWorkOrder.paid_at} includeTime />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-3 flex flex-wrap gap-2">
              {selectedWorkOrder.vat_applied && (
                <button
                  onClick={() => goToReceipt(selectedWorkOrder.id)}
                  className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> View / Print Receipt
                </button>
              )}
              <button
                onClick={() => setSelectedWorkOrder(null)}
                className="flex-1 min-w-[100px] bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg"
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

export default WorkHistory;