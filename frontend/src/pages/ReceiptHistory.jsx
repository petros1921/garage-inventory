import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Receipt, Printer, Search, X } from 'lucide-react';
import EthiopianDate from '../components/EthiopianDate';

function ReceiptHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const [ordersRes, workRes] = await Promise.all([
          api.get('/orders/all?limit=500'),
          api.get('/work-orders/with-parts?limit=500'),
        ]);

        const paidOrders = (ordersRes.data.orders || []).filter(
          o => o.status === 'paid' || o.status === 'completed'
        );
        const paidWork = (workRes.data.workOrders || []).filter(
          w => w.status === 'paid' || w.status === 'completed'
        );

        const merged = [
          ...paidOrders.map(o => ({
            id: o.id,
            type: 'part',
            typeLabel: 'Part Order',
            number: o.order_number,
            customer: o.customer_name,
            total: (o.order_items || []).reduce(
              (s, i) => s + (i.selling_price_at_time || 0) * (i.quantity || 0), 0
            ),
            subtotal: o.subtotal || 0,
            vat_applied: o.vat_applied,
            vat_amount: o.vat_amount || 0,
            fs_number: o.fs_number,
            customer_tin: o.customer_tin,
            date: o.issued_at || o.paid_at || o.created_at,
          })),
          ...paidWork.map(w => ({
            id: w.id,
            type: 'work',
            typeLabel: 'Work Order',
            number: w.work_order_number,
            customer: w.customer_name,
            total: w.total_amount || 0,
            subtotal: w.subtotal || ((w.labor_charge || 0) + (w.total_parts_cost || 0)),
            vat_applied: w.vat_applied,
            vat_amount: w.vat_amount || 0,
            fs_number: w.fs_number,
            customer_tin: w.customer_tin,
            date: w.paid_at || w.issued_at || w.created_at,
          })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

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
    if (dateFrom && new Date(o.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(o.date) > new Date(dateTo + 'T23:59:59')) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (o.number || '').toLowerCase().includes(q) ||
        (o.customer || '').toLowerCase().includes(q) ||
        (o.fs_number || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const vatTotal = filtered.filter(o => o.vat_applied).reduce((s, o) => s + (o.total || 0), 0);
  const totalVatCollected = filtered.filter(o => o.vat_applied).reduce((s, o) => s + (o.vat_amount || 0), 0);

  if (loading) return <div className="p-8 text-center">Loading receipt history...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Receipt size={24} className="text-blue-600" />
          Receipt History
        </h1>
        <p className="text-gray-500 text-sm">All paid orders — view, filter, and reprint receipts</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Receipts</p>
          <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-blue-600">With VAT</p>
          <p className="text-2xl font-bold text-blue-700">{filtered.filter(o => o.vat_applied).length}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-emerald-600">Total with VAT</p>
          <p className="text-xl font-bold text-emerald-700">ETB {vatTotal.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-purple-600">VAT Collected</p>
          <p className="text-xl font-bold text-purple-700">ETB {totalVatCollected.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {[
            { key: 'all', label: 'All', count: orders.length },
            { key: 'vat', label: 'With VAT', count: orders.filter(o => o.vat_applied).length },
            { key: 'no-vat', label: 'Without VAT', count: orders.filter(o => !o.vat_applied).length },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                filter === f.key ? 'bg-white bg-opacity-25' : 'bg-white border'
              }`}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order #, customer, FS#"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            title="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            title="To"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Receipt size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No receipts found.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Order #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">FS #</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Subtotal</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">VAT</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={`${o.type}-${o.id}`} className="hover:bg-gray-50 border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-blue-600 font-semibold whitespace-nowrap">{o.number}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {o.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.customer}</td>
                    <td className="px-4 py-3 font-mono text-xs text-purple-600">{o.fs_number || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">ETB {(o.subtotal || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      {o.vat_applied ? (
                        <span className="text-blue-600 font-medium">ETB {(o.vat_amount || 0).toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">ETB {(o.total || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <EthiopianDate date={o.date} includeTime />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        {o.vat_applied ? (
                          <button
                            onClick={() => navigate(`/receipt/${o.type}/${o.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                          >
                            <Printer size={12} /> Receipt
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic whitespace-nowrap">No VAT</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptHistory;