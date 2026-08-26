import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, ShoppingCart } from 'lucide-react';

function Request() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ requested_quantity: 1, reason: 'Maintenance', ordered_by_name: '', ordered_by_type: 'Technician', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchParts(); }, []);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/parts');
      setParts(res.data.parts || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length < 2) { fetchParts(); return; }
    try {
      const res = await api.get(`/parts/search?q=${encodeURIComponent(term)}`);
      setParts(res.data.parts || []);
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const res = await api.post('/requests', {
        part_id: selectedPart.id,
        requested_quantity: parseInt(formData.requested_quantity),
        reason: formData.reason,
        ordered_by_name: formData.ordered_by_name,
        ordered_by_type: formData.ordered_by_type,
        notes: formData.notes,
        frontdesk_user_id: user?.id
      });
      if (res.data.success) {
        alert('✅ Request sent to Cashier.');
        setShowModal(false);
        setSelectedPart(null);
        setFormData({ requested_quantity: 1, reason: 'Maintenance', ordered_by_name: '', ordered_by_type: 'Technician', notes: '' });
        fetchParts();
      }
    } catch (error) {
      alert(`❌ Error: ${error.response?.data?.error || 'Failed'}`);
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Search className="text-blue-600" /> Front Desk – Request</h1>
      <p className="text-gray-500 text-sm mb-6">Search and fill request form (FS number left blank)</p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input type="text" placeholder="Search..." value={searchTerm} onChange={handleSearch} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parts.filter(p => p.quantity > 0).map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md cursor-pointer" onClick={() => { setSelectedPart(p); setShowModal(true); }}>
            <div className="flex justify-between"><span className="font-mono text-sm text-blue-600">{p.item_code}</span><span className="text-sm font-bold">Qty: {p.quantity}</span></div>
            <h3 className="font-semibold">{p.item_name}</h3>
            <p className="text-sm text-gray-500">{p.car_brand} {p.car_model}</p>
            <button className="mt-3 w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg text-sm">Request</button>
          </div>
        ))}
      </div>

      {showModal && selectedPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4">Submit Request</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-semibold">{selectedPart.item_name}</p>
              <p className="text-sm text-gray-500">{selectedPart.item_code}</p>
              <p>Available: {selectedPart.quantity}</p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Quantity *</label><input type="number" required min="1" max={selectedPart.quantity} value={formData.requested_quantity} onChange={e => setFormData({...formData, requested_quantity: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-1">Reason *</label><select required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="Maintenance">Maintenance</option><option value="External Buyer">External Buyer</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Ordered By *</label><input type="text" required value={formData.ordered_by_name} onChange={e => setFormData({...formData, ordered_by_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium mb-1">Notes</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none" rows="2" /></div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex-1 flex items-center justify-center gap-2">{submitting ? 'Sending...' : 'Send to Cashier'} <ShoppingCart size={18} /></button>
                <button type="button" onClick={() => { setShowModal(false); setSelectedPart(null); }} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Request;