import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Package, Search, Printer, TrendingUp, Download } from 'lucide-react';
import { exportToExcel } from '../utils/exportToExcel';
import EthiopianDate from '../components/EthiopianDate';
import { formatEthiopian } from '../utils/ethiopianDate';
import EthiopianDatePicker from '../components/EthiopianDatePicker';

function ItemSoldHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total_items: 0, total_quantity: 0, total_revenue: 0, total_vat: 0, unique_orders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vatFilter, setVatFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const params = {};
        if (dateFrom) params.from = dateFrom;
        if (dateTo) params.to = dateTo;
        const res = await api.get('/items-sold', { params });
        setItems(res.data.items || []);
        setSummary(res.data.summary || {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [dateFrom, dateTo]);

  const filtered = items.filter(i => {
    if (vatFilter === 'yes' && !i.vat_applied) return false;
    if (vatFilter === 'no' && i.vat_applied) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (i.order_number || '').toLowerCase().includes(q) ||
      (i.customer_name || '').toLowerCase().includes(q) ||
      (i.part_name || '').toLowerCase().includes(q) ||
      (i.part_code || '').toLowerCase().includes(q) ||
      (i.brand || '').toLowerCase().includes(q)
    );
  });

  const handleExport = () => {
    if (filtered.length === 0) {
      alert('No data to export. Adjust your filters or search.');
      return;
    }

    const rows = filtered.map(i => ({
      'Order #': i.order_number || '',
      'Source Type': i.source_type === 'part_order' ? 'Part Order' : 'Work Order',
      'Buyer Name': i.customer_name || '',
      'Buyer Type': i.customer_type || '',
      'Item Name': i.part_name || '',
      'Item Code': i.part_code || '',
      'Brand': i.brand || '',
      'Model': i.model || '',
      'Condition': i.condition || '',
      'Quantity': i.quantity || 0,
      'Unit Price (ETB)': +(i.unit_price || 0).toFixed(2),
      'Line Total (ETB)': +(i.line_total || 0).toFixed(2),
      'VAT Applied': i.vat_applied ? 'Yes' : 'No',
      'FS Number': i.fs_number || '',
      'VAT Amount (ETB)': i.vat_applied ? +(i.vat_amount || 0).toFixed(2) : 0,
      'Sold At (Ethiopian)': i.sold_at ? formatEthiopian(i.sold_at) : '',
      'Sold At (Gregorian)': i.sold_at ? new Date(i.sold_at).toLocaleString() : '',
    }));

    rows.push({
      'Order #': '', 'Source Type': '', 'Buyer Name': '', 'Buyer Type': '',
      'Item Name': 'TOTAL', 'Item Code': '', 'Brand': '', 'Model': '', 'Condition': '',
      'Quantity': rows.reduce((s, r) => s + (r['Quantity'] || 0), 0),
      'Unit Price (ETB)': '',
      'Line Total (ETB)': +rows.reduce((s, r) => s + (r['Line Total (ETB)'] || 0), 0).toFixed(2),
      'VAT Applied': '', 'FS Number': '',
      'VAT Amount (ETB)': +rows.reduce((s, r) => s + (r['VAT Amount (ETB)'] || 0), 0).toFixed(2),
      'Sold At (Ethiopian)': '', 'Sold At (Gregorian)': '',
    });

    exportToExcel(rows, 'items_sold_history', 'Items Sold');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package size={24} className="text-indigo-600" />
            Items Sold History
          </h1>
          <p className="text-gray-500 text-sm">
            Every item sold — with order, buyer, VAT, and receipt access
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || filtered.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} /> Export Excel ({filtered.length})
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Unique Orders</p>
          <p className="text-xl font-bold text-gray-800">{summary.unique_orders || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Line Items</p>
          <p className="text-xl font-bold text-gray-800">{summary.total_items || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Total Qty Sold</p>
          <p className="text-xl font-bold text-gray-800">{summary.total_quantity || 0}</p>
        </div>
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <TrendingUp size={12} /> Revenue
          </p>
          <p className="text-lg font-bold text-emerald-800">ETB {(summary.total_revenue || 0).toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-purple-600">VAT Collected</p>
          <p className="text-lg font-bold text-purple-800">ETB {(summary.total_vat || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Filters with Ethiopian Date Pickers */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: order #, buyer, item, brand..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={vatFilter}
            onChange={(e) => setVatFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Sales</option>
            <option value="yes">With VAT</option>
            <option value="no">Without VAT</option>
          </select>
          <EthiopianDatePicker label="From (ከ)" value={dateFrom} onChange={setDateFrom} />
          <EthiopianDatePicker label="To (እስከ)" value={dateTo} onChange={setDateTo} />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading items...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No items sold matching your filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Order #</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Buyer</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Item</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">Qty</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700">Unit</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">VAT</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Sold</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={`${i.source_type}-${i.id}`} className="hover:bg-gray-50 border-b last:border-0">
                    <td className="px-3 py-3 font-mono text-blue-600 font-semibold whitespace-nowrap">
                      {i.order_number}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {i.customer_name}
                      <span className="block text-xs text-gray-400">{i.customer_type}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{i.part_name}</div>
                      <div className="text-xs text-gray-500">
                        {i.part_code}
                        {i.brand ? ` · ${i.brand}` : ''}
                        {i.model ? ` ${i.model}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">{i.quantity}</td>
                    <td className="px-3 py-3 text-right">{i.unit_price.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">
                      {i.line_total.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {i.vat_applied ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                          FS#{i.fs_number || '—'}
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          No VAT
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {i.sold_at ? <EthiopianDate date={i.sold_at} /> : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {i.vat_applied ? (
                        <button
                          onClick={() =>
                            navigate(
                              `/receipt/${i.source_type === 'part_order' ? 'part' : 'work'}/${i.source_id}`
                            )
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1 mx-auto whitespace-nowrap"
                        >
                          <Printer size={12} /> View
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
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

export default ItemSoldHistory;