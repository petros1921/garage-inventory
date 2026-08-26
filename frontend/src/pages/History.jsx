import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History as HistoryIcon, Search } from 'lucide-react';

function History() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

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
    if (filter === 'sale' && m.reason !== 'Sale') return false;
    if (filter === 'restock' && m.reason !== 'Restock') return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <HistoryIcon size={24} className="text-gray-600" />
          Stock Movement History
        </h1>
        <p className="text-gray-500 text-sm">Complete audit log of all inventory changes</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by item, code, or person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="all">All Movements</option>
            <option value="sale">Sales</option>
            <option value="restock">Restocks</option>
          </select>
          <button
            onClick={() => { setSearchTerm(''); setFilter('all'); }}
            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm transition"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {filteredMovements.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No movements found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
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
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(movement.created_at).toLocaleDateString()}
                      <span className="text-xs text-gray-400 block">
                        {new Date(movement.created_at).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {movement.parts?.item_name || 'Deleted'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-blue-600">
                      {movement.parts?.item_code || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${movement.quantity_change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.quantity_change < 0 ? '' : '+'}{movement.quantity_change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        movement.reason === 'Sale' ? 'bg-blue-100 text-blue-600' :
                        movement.reason === 'Restock' ? 'bg-green-100 text-green-600' :
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