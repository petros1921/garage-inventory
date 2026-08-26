import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History, Search, X } from 'lucide-react';

function WorkHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      // Fetch work orders that are paid or completed, with parts
      const res = await api.get('/work-orders/with-parts');
      // Filter to only show paid or completed
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
      archived: 'bg-gray-200 text-gray-500'
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
  };

  const filtered = history.filter(h =>
    h.customer_name?.toLowerCase().includes(filter.toLowerCase()) ||
    h.work_order_number?.toLowerCase().includes(filter.toLowerCase()) ||
    h.assigned_technician?.toLowerCase().includes(filter.toLowerCase()) ||
    h.part_received?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <History size={24} className="text-blue-600" />
        Work History (Manager Only)
      </h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Filter by customer, order #, technician, or part..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No work history found.</div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Order #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Part Received</th>
                <th className="px-4 py-2 text-left hidden lg:table-cell">Technician</th>
                <th className="px-4 py-2 text-left">Parts</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Total</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(h => (
                <tr key={h.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedWorkOrder(h)}>
                  <td className="px-4 py-2 font-mono text-blue-600">{h.work_order_number}</td>
                  <td className="px-4 py-2">{h.customer_name}</td>
                  <td className="px-4 py-2 hidden md:table-cell">{h.part_received || '-'}</td>
                  <td className="px-4 py-2 hidden lg:table-cell">{h.assigned_technician}</td>
                  <td className="px-4 py-2">{h.work_order_parts?.length || 0}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">${h.total_amount || 0}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedWorkOrder(h); }}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======== DETAIL MODAL ======== */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedWorkOrder.work_order_number}</h2>
              <button onClick={() => setSelectedWorkOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <p><strong>Customer:</strong> {selectedWorkOrder.customer_name}</p>
              <p><strong>Phone:</strong> {selectedWorkOrder.customer_phone || '-'}</p>
              <p><strong>Part Received:</strong> {selectedWorkOrder.part_received || '-'}</p>
              <p><strong>Customer Part #:</strong> {selectedWorkOrder.customer_part_number || '-'}</p>
              <p><strong>Technician:</strong> {selectedWorkOrder.assigned_technician || '-'}</p>
              <p><strong>Status:</strong> <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedWorkOrder.status)}`}>{selectedWorkOrder.status}</span></p>
              <p><strong>Diagnosis Notes:</strong> {selectedWorkOrder.diagnosis_notes || '-'}</p>
              <p><strong>Work Price:</strong> ${selectedWorkOrder.work_price}</p>
              <p><strong>Part Price:</strong> ${selectedWorkOrder.part_price}</p>
              <p><strong>Total:</strong> ${selectedWorkOrder.total_price}</p>
              <p><strong>FS#:</strong> {selectedWorkOrder.fs_number || 'Not set'}</p>
              <p><strong>Created At:</strong> {new Date(selectedWorkOrder.created_at).toLocaleString()}</p>
              {selectedWorkOrder.approved_at && (
                <p><strong>Approved At:</strong> {new Date(selectedWorkOrder.approved_at).toLocaleString()}</p>
              )}
              {selectedWorkOrder.issued_at && (
                <p><strong>Issued At:</strong> {new Date(selectedWorkOrder.issued_at).toLocaleString()}</p>
              )}
              {selectedWorkOrder.paid_at && (
                <p><strong>Paid At:</strong> {new Date(selectedWorkOrder.paid_at).toLocaleString()}</p>
              )}
            </div>

            <h3 className="font-semibold mt-4 mb-2">Parts Used</h3>
            <div className="border rounded-lg p-2 max-h-40 overflow-y-auto">
              {selectedWorkOrder.work_order_parts?.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-1 text-left">Part</th>
                      <th className="px-2 py-1 text-left">Code</th>
                      <th className="px-2 py-1 text-left">Quantity</th>
                      <th className="px-2 py-1 text-left">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkOrder.work_order_parts.map(wp => (
                      <tr key={wp.id} className="border-b">
                        <td className="px-2 py-1">{wp.part?.item_name || 'Unknown'}</td>
                        <td className="px-2 py-1 font-mono text-blue-600">{wp.part?.item_code || 'N/A'}</td>
                        <td className="px-2 py-1">{wp.quantity}</td>
                        <td className="px-2 py-1">${wp.part?.selling_price || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-400">No parts added.</p>
              )}
            </div>

            <button
              onClick={() => setSelectedWorkOrder(null)}
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

export default WorkHistory;