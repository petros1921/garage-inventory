import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Download, Calendar,
  Wrench, Package, ShoppingCart, PiggyBank, Filter
} from 'lucide-react';
import { exportToExcel } from '../utils/exportToExcel';

const PIE_COLORS = ['#3b82f6', '#8b5cf6'];
const CHART_COLORS = { itemSales: '#3b82f6', workOrders: '#8b5cf6', expenses: '#f43f5e' };

function FinancialStatus() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    itemSalesRevenue: 0, workOrderRevenue: 0, totalIncome: 0,
    totalExpenses: 0, netProfit: 0,
    counts: { partOrders: 0, workOrders: 0, purchases: 0 },
  });
  const [monthly, setMonthly] = useState([]);
  const [pettyCash, setPettyCash] = useState({ summary: {}, allocations: [], transactions: [] });

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preset, setPreset] = useState('this-year');

  // Apply preset
  const applyPreset = (key) => {
    setPreset(key);
    const today = new Date();
    let from = '';
    let to = today.toISOString().split('T')[0];
    if (key === 'this-month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (key === 'this-year') {
      from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else if (key === 'last-30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      from = d.toISOString().split('T')[0];
    } else if (key === 'last-90') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      from = d.toISOString().split('T')[0];
    } else if (key === 'all') {
      from = '';
      to = '';
    }
    setDateFrom(from);
    setDateTo(to);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const [finRes, pcRes] = await Promise.all([
        api.get('/financial-summary', { params }),
        api.get('/petty-cash/report', { params }),
      ]);

      setSummary(finRes.data.summary || {});
      setMonthly(finRes.data.monthly || []);
      setPettyCash({
        summary: pcRes.data.summary || {},
        allocations: pcRes.data.allocations || [],
        transactions: pcRes.data.transactions || [],
      });
    } catch (err) {
      console.error('fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== Export handlers =====
  const exportSummary = () => {
    const rows = monthly.map(m => ({
      Month: m.label,
      'Item Sales (ETB)': m.itemSales,
      'Work Orders (ETB)': m.workOrders,
      'Total Income (ETB)': m.totalIncome,
      'Expenses (ETB)': m.expenses,
      'Net Profit (ETB)': m.netProfit,
    }));
    // Add totals row
    rows.push({
      Month: 'TOTAL',
      'Item Sales (ETB)': summary.itemSalesRevenue,
      'Work Orders (ETB)': summary.workOrderRevenue,
      'Total Income (ETB)': summary.totalIncome,
      'Expenses (ETB)': summary.totalExpenses,
      'Net Profit (ETB)': summary.netProfit,
    });
    exportToExcel(rows, 'financial_summary', 'Financials');
  };

  const exportPettyCash = () => {
    const allocRows = pettyCash.allocations.map(a => ({
      Type: 'Allocation',
      Date: new Date(a.week_start).toLocaleDateString(),
      Week_End: new Date(a.week_end).toLocaleDateString(),
      Amount_ETB: parseFloat(a.amount) || 0,
      Reference: '—',
      Notes: a.notes || '',
    }));
    const txRows = pettyCash.transactions.map(t => ({
      Type: t.type === 'payment' ? 'Payment' : t.type,
      Date: new Date(t.created_at).toLocaleString(),
      Week_End: '—',
      Amount_ETB: -parseFloat(t.amount) || 0,
      Reference: t.purchase_orders?.order_number || '—',
      Notes: t.purchase_orders?.item_description || '',
    }));
    const all = [...allocRows, ...txRows];
    exportToExcel(all, 'petty_cash_report', 'Petty Cash');
  };

  const exportAll = () => {
    exportSummary();
    setTimeout(exportPettyCash, 300);
  };

  const profitColor = summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700';

  const pieData = [
    { name: 'Item Sales', value: summary.itemSalesRevenue || 0 },
    { name: 'Work Orders', value: summary.workOrderRevenue || 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wallet size={24} className="text-emerald-600" />
            Financial Status
          </h1>
          <p className="text-gray-500 text-sm">
            Complete overview of income, expenses, and petty cash
          </p>
        </div>
        <button
          onClick={exportAll}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <Download size={18} /> Export All to Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
            <Filter size={14} /> Quick filter:
          </span>
          {[
            { key: 'this-month', label: 'This Month' },
            { key: 'last-30', label: 'Last 30 Days' },
            { key: 'last-90', label: 'Last 90 Days' },
            { key: 'this-year', label: 'This Year' },
            { key: 'all', label: 'All Time' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                preset === p.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPreset('custom'); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPreset('custom'); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPreset('custom'); }}
              className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
            >
              Clear Dates
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading financial data...</div>
      ) : (
        <>
          {/* ===== Summary Cards ===== */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-blue-600 font-medium">Item Sales</p>
                <Package size={16} className="text-blue-600" />
              </div>
              <p className="text-xl font-bold text-blue-800">
                ETB {summary.itemSalesRevenue?.toFixed(2) || '0.00'}
              </p>
              <p className="text-[10px] text-blue-500 mt-1">
                {summary.counts?.partOrders || 0} orders
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-purple-600 font-medium">Work Orders</p>
                <Wrench size={16} className="text-purple-600" />
              </div>
              <p className="text-xl font-bold text-purple-800">
                ETB {summary.workOrderRevenue?.toFixed(2) || '0.00'}
              </p>
              <p className="text-[10px] text-purple-500 mt-1">
                {summary.counts?.workOrders || 0} orders
              </p>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-emerald-600 font-medium">Total Income</p>
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-emerald-800">
                ETB {summary.totalIncome?.toFixed(2) || '0.00'}
              </p>
              <p className="text-[10px] text-emerald-500 mt-1">Combined</p>
            </div>

            <div className="bg-gradient-to-r from-rose-50 to-rose-100 border border-rose-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-rose-600 font-medium">Expenses</p>
                <TrendingDown size={16} className="text-rose-600" />
              </div>
              <p className="text-xl font-bold text-rose-800">
                ETB {summary.totalExpenses?.toFixed(2) || '0.00'}
              </p>
              <p className="text-[10px] text-rose-500 mt-1">
                {summary.counts?.purchases || 0} purchases
              </p>
            </div>

            <div className={`bg-gradient-to-r ${summary.netProfit >= 0 ? 'from-teal-50 to-teal-100 border-teal-200' : 'from-red-50 to-red-100 border-red-200'} border rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-600">Net Profit</p>
                <DollarSign size={16} className={profitColor} />
              </div>
              <p className={`text-xl font-bold ${profitColor}`}>
                ETB {summary.netProfit?.toFixed(2) || '0.00'}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {summary.netProfit >= 0 ? 'Profit' : 'Loss'}
              </p>
            </div>
          </div>

          {/* ===== Charts Row 1 ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Combined Cashflow */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Calendar size={16} className="text-gray-500" />
                  Monthly Cashflow
                </h2>
                <button
                  onClick={exportSummary}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md font-medium flex items-center gap-1"
                >
                  <Download size={12} /> Excel
                </button>
              </div>
              {monthly.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  No data in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `ETB ${Number(v).toFixed(2)}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="itemSales" name="Item Sales" fill={CHART_COLORS.itemSales} stackId="income" />
                    <Bar dataKey="workOrders" name="Work Orders" fill={CHART_COLORS.workOrders} stackId="income" />
                    <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.expenses} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Income Breakdown Pie */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Income Breakdown</h2>
              {(summary.itemSalesRevenue + summary.workOrderRevenue) === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  No income data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${Number(value).toFixed(0)}`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `ETB ${Number(v).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ===== Net Profit Trend ===== */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" />
              Net Profit Trend
            </h2>
            {monthly.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-gray-400">
                No data in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `ETB ${Number(v).toFixed(2)}`} />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Net Profit"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ===== Petty Cash Report ===== */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b flex flex-wrap justify-between items-center gap-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <PiggyBank size={18} className="text-purple-600" />
                Petty Cash Report
              </h2>
              <button
                onClick={exportPettyCash}
                className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md font-medium flex items-center gap-1"
              >
                <Download size={12} /> Excel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border-b bg-gray-50">
              <div>
                <p className="text-xs text-gray-500">Total Allocated</p>
                <p className="text-lg font-bold text-purple-700">
                  ETB {pettyCash.summary?.totalAllocated?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Spent</p>
                <p className="text-lg font-bold text-rose-700">
                  ETB {pettyCash.summary?.totalSpent?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Current Balance</p>
                <p className="text-lg font-bold text-emerald-700">
                  ETB {pettyCash.summary?.balance?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>

            {/* Weekly allocations */}
            <div className="p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Weekly Allocations
              </h3>
              {pettyCash.allocations.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No allocations in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Week Start</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Week End</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount (ETB)</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pettyCash.allocations.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            {new Date(a.week_start).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            {new Date(a.week_end).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-purple-700">
                            +{(parseFloat(a.amount) || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">
                            {a.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-6">
                Recent Payments
              </h3>
              {pettyCash.transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No payments in this period</p>
              ) : (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Order</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pettyCash.transactions.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs">
                            {new Date(t.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-blue-600">
                            {t.purchase_orders?.order_number || '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {t.purchase_orders?.item_description || '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-rose-700">
                            −{(parseFloat(t.amount) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ===== Income Statement Table ===== */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b flex justify-between items-center">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                Income Statement
              </h2>
              <button
                onClick={exportSummary}
                className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md font-medium flex items-center gap-1"
              >
                <Download size={12} /> Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Month</th>
                    <th className="px-4 py-3 text-right font-semibold text-blue-600">Item Sales</th>
                    <th className="px-4 py-3 text-right font-semibold text-purple-600">Work Orders</th>
                    <th className="px-4 py-3 text-right font-semibold text-emerald-700">Total Income</th>
                    <th className="px-4 py-3 text-right font-semibold text-rose-600">Expenses</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-800">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthly.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                        No data in this period
                      </td>
                    </tr>
                  ) : (
                    <>
                      {monthly.map(m => (
                        <tr key={m.month} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{m.label}</td>
                          <td className="px-4 py-3 text-right text-blue-700">
                            {m.itemSales.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-purple-700">
                            {m.workOrders.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                            {m.totalIncome.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-700">
                            {m.expenses.toFixed(2)}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${m.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {m.netProfit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-gray-100 font-bold">
                        <td className="px-4 py-3">TOTAL</td>
                        <td className="px-4 py-3 text-right text-blue-800">
                          {summary.itemSalesRevenue?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-800">
                          {summary.workOrderRevenue?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-800">
                          {summary.totalIncome?.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-800">
                          {summary.totalExpenses?.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-right ${summary.netProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                          {summary.netProfit?.toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FinancialStatus;