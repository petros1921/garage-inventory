import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History as HistoryIcon, Search, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import EthiopianDate from '../components/EthiopianDate';
import EthiopianDatePicker from '../components/EthiopianDatePicker';
import { formatEthiopian } from '../utils/ethiopianDate';
import { exportToExcel } from '../utils/exportToExcel';

function History() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/movements');
      setMovements(response.data.movements || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter(m => {
    // Date range filter
    if (dateFrom || dateTo) {
      const d = new Date(m.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    }
    // Reason filter
    if (filter === 'sale' && m.reason !== 'Sale' && m.reason !== 'Work Order Sale') return false;
    if (filter === 'restock' && m.reason !== 'Restock') return false;
    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matches =
        m.parts?.item_name?.toLowerCase().includes(search) ||
        m.parts?.item_code?.toLowerCase().includes(search) ||
        m.ordered_by_name?.toLowerCase().includes(search) ||
        m.approved_by_name?.toLowerCase().includes(search) ||
        m.reason?.toLowerCase().includes(search);
      if (!matches) return false;
    }
    return true;
  });

  const handleExport = () => {
    if (filteredMovements.length === 0) {
      alert('No data to export. Adjust your filters.');
      return;
    }
    const rows = filteredMovements.map(m => ({
      'Date (Ethiopian)': m.created_at ? formatEthiopian(m.created_at) : '',
      'Date (Gregorian)': m.created_at ? new Date(m.created_at).toLocaleString() : '',
      'Item Name': m.parts?.item_name || 'Deleted',
      'Item Code': m.parts?.item_code || 'N/A',
      'Change': m.quantity_change,
      'Movement': m.quantity_change < 0 ? 'Out' : 'In',
      'Reason': m.reason || '-',
      'Ordered By': m.ordered_by_name || '-',
      'Approved By': m.approved_by_name || '-',
    }));
    exportToExcel(rows, 'stock_movements', 'Stock Movements');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = searchTerm || filter !== 'all' || dateFrom || dateTo;

  // Summary stats
  const totalIn = filteredMovements.filter(m => m.quantity_change > 0).reduce((s, m) => s + m.quantity_change, 0);
  const totalOut = filteredMovements.filter(m => m.quantity_change < 0).reduce((s, m) => s + Math.abs(m.quantity_change), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <HistoryIcon size={24} className="text-gray-700" />
            Stock Movement History
          </h1>
          <p className="text-gray-500 text-sm">Complete audit log of all inventory changes</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredMovements.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={16} /> Export Excel ({filteredMovements.length})
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500">Total Movements</p>
          <p className="text-xl font-bold text-gray-800">{filteredMovements.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1 text-green-700 mb-1">
            <ArrowUpCircle size={14} />
            <p className="text-xs font-medium">Items In</p>
          </div>
          <p className="text-xl font-bold text-green-800">{totalIn}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1 text-red-700 mb-1">
            <ArrowDownCircle size={14} />
            <p className="text-xs font-medium">Items Out</p>
          </div>
          <p className="text-xl font-bold text-red-800">{totalOut}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-blue-700 font-medium">Restocks</p>
          <p className="text-xl font-bold text-blue-800">
            {filteredMovements.filter(m => m.reason === 'Restock').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item, code, or person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="all">All Movements</option>
            <option value="sale">Sales</option>
            <option value="restock">Restocks</option>
          </select>
          <EthiopianDatePicker label="From (ከ)" value={dateFrom} onChange={setDateFrom} />
          <EthiopianDatePicker label="To (እስከ)" value={dateTo} onChange={setDateTo} />
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing <strong>{filteredMovements.length}</strong> of {movements.length} movements
            </span>
            <button
              onClick={clearFilters}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <HistoryIcon size={48} className="mx-auto text-gray-300 mb-3" />
            <p>No movements found.</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:text-blue-800">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Ordered By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      <EthiopianDate date={movement.created_at} />
                      <span className="text-xs text-gray-400 block">
                        {new Date(movement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {movement.parts?.item_name || 'Deleted'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-blue-600">
                      {movement.parts?.item_code || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 font-bold ${movement.quantity_change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.quantity_change < 0 ? (
                          <ArrowDownCircle size={14} />
                        ) : (
                          <ArrowUpCircle size={14} />
                        )}
                        {movement.quantity_change < 0 ? '' : '+'}{movement.quantity_change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        movement.reason === 'Sale' || movement.reason === 'Work Order Sale' ? 'bg-blue-100 text-blue-700' :
                        movement.reason === 'Restock' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {movement.reason || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {movement.ordered_by_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {movement.approved_by_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default History;