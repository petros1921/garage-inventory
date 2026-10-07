import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Printer, ArrowLeft } from 'lucide-react';
import EthiopianDate from '../components/EthiopianDate';

// --- Amount to Words (English) ---
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '');
    return n.toString();
  };

  const birr = Math.floor(num);
  const cents = Math.round((num - birr) * 100);
  const birrText = birr === 0 ? 'Zero' : convert(birr);
  const centsText = cents === 0 ? 'Zero Cents' : convert(cents) + ' Cents';
  return `${birrText} Birr and ${centsText} Only`;
};

function Receipt() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = user.role;
      if (role === 'manager') navigate('/dashboard');
      else if (role === 'cashier') navigate('/cashier');
      else if (role === 'storekeeper') navigate('/storekeeper');
      else if (role === 'frontdesk') navigate('/frontdesk');
      else navigate('/');
    } catch {
      navigate('/');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (type === 'part') {
          const res = await api.get(`/orders/${id}`);
          setData(res.data.order);
        } else if (type === 'work') {
          const res = await api.get(`/work-orders/${id}`);
          setData(res.data.workOrder);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [type, id]);

  if (loading) return <div className="p-12 text-center">Loading receipt...</div>;
  if (error || !data) return <div className="p-12 text-center text-red-600">{error || 'Not found'}</div>;

  let items = [];
  if (type === 'part') {
    items = (data.order_items || []).map(it => ({
      id: it.id,
      description: `${it.parts?.item_name || 'Part'}${it.parts?.item_code ? ' (' + it.parts.item_code + ')' : ''}${it.parts?.car_brand ? ' — ' + it.parts.car_brand + ' ' + (it.parts.car_model || '') : ''}`,
      unit: 'PCS',
      qty: it.quantity || 1,
      price: it.selling_price_at_time || 0,
      total: (it.selling_price_at_time || 0) * (it.quantity || 1),
    }));
  } else {
    if (data.labor_charge > 0) {
      items.push({
        id: 'labor',
        description: `Work Labor (${data.assigned_technician || 'Technician'})`,
        unit: 'JOB',
        qty: 1,
        price: data.labor_charge,
        total: data.labor_charge,
      });
    }
    if (data.machine_cost > 0) {
      items.push({
        id: 'machine',
        description: 'Machine Cost',
        unit: 'JOB',
        qty: 1,
        price: data.machine_cost,
        total: data.machine_cost,
      });
    }
    (data.work_order_parts || []).forEach(wp => {
      const price = wp.selling_price_at_time || wp.selling_price || wp.part?.selling_price || 0;
      items.push({
        id: wp.id,
        description: `${wp.part?.item_name || 'Part'}${wp.part?.item_code ? ' (' + wp.part.item_code + ')' : ''}`,
        unit: 'PCS',
        qty: wp.quantity || 1,
        price,
        total: price * (wp.quantity || 1),
      });
    });
  }

  const subtotal = data.subtotal != null
    ? parseFloat(data.subtotal)
    : items.reduce((s, i) => s + i.total, 0);
  const vatAmount = parseFloat(data.vat_amount) || 0;
  const grandTotal = subtotal + vatAmount;

  const orderNumber = type === 'part' ? data.order_number : data.work_order_number;
  const customerName = data.customer_name;
  const customerTin = data.customer_tin;
  const dateStr = data.issued_at || data.paid_at || data.created_at || new Date().toISOString();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="print:hidden bg-white border-b px-4 py-3 flex justify-between items-center max-w-4xl mx-auto">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium"
        >
          <Printer size={18} /> Print Receipt
        </button>
      </div>

      <div className="relative max-w-4xl mx-auto bg-white my-6 p-8 shadow print:shadow-none print:my-0 print:p-6 overflow-hidden">
        {/* Watermark */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        >
          <span
            className="font-bold"
            style={{
              fontSize: '130px',
              transform: 'rotate(-30deg)',
              letterSpacing: '10px',
              color: '#9ca3af',
              opacity: 0.35,
              whiteSpace: 'nowrap',
            }}
          >
            Attachment
          </span>
        </div>

        {/* Header */}
        <div className="relative text-center border-b-2 border-gray-800 pb-4 mb-4">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
            ኮከብ ወርቁ ሁለገብ ተሽከርካሪዎች እና የተሸከርካሪ አካላት ጥገና
          </h1>
          <h2 className="text-lg font-bold mt-1">Kokeb Worku Multipurpose Vehicles &amp; Parts Maintenance</h2>
          <div className="flex justify-between items-center mt-2 text-sm">
            <span>Supplier's TIN No. <strong>0014264781</strong></span>
            <span>📞 0944 24 8807</span>
          </div>
        </div>

        <div className="relative text-center mb-4">
          <h3 className="text-xl font-bold tracking-wide">CASH SALES RECEIPT</h3>
        </div>

        {/* Ref block — Date now shows both calendars */}
        <div className="relative grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="border border-gray-400 p-2">
            <div className="text-gray-600 text-xs">Date:</div>
            <div className="font-medium">{new Date(dateStr).toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              <EthiopianDate date={dateStr} />
            </div>
          </div>
          <div className="border border-gray-400 p-2">
            <span className="text-gray-600">Ref. No:</span>{' '}
            <span className="font-mono font-medium">{orderNumber}</span>
          </div>
          <div className="border border-gray-400 p-2 col-span-2">
            <span className="text-gray-600">FS.No:</span>{' '}
            <span className="font-mono font-medium">{data.fs_number || '—'}</span>
          </div>
        </div>

        <div className="relative border border-gray-400 p-2 mb-4 text-sm space-y-1">
          <div>
            <span className="text-gray-600">Bill to:</span>{' '}
            <span className="font-medium">{customerName}</span>
          </div>
          <div>
            <span className="text-gray-600">TIN:</span>{' '}
            <span className="font-mono">{customerTin || '—'}</span>
          </div>
          {data.customer_phone && (
            <div><span className="text-gray-600">Phone:</span> {data.customer_phone}</div>
          )}
          {data.customer_type && (
            <div><span className="text-gray-600">Type:</span> {data.customer_type}</div>
          )}
        </div>

        <table className="relative w-full border-collapse mb-4 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-2 text-left w-10">No.</th>
              <th className="border border-gray-400 px-2 py-2 text-left">Description</th>
              <th className="border border-gray-400 px-2 py-2 text-center w-16">Unit</th>
              <th className="border border-gray-400 px-2 py-2 text-center w-16">Qty</th>
              <th className="border border-gray-400 px-2 py-2 text-right w-24">Unit Price</th>
              <th className="border border-gray-400 px-2 py-2 text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <td className="border border-gray-400 px-2 py-2 text-center">{i + 1}</td>
                <td className="border border-gray-400 px-2 py-2">{it.description}</td>
                <td className="border border-gray-400 px-2 py-2 text-center">{it.unit}</td>
                <td className="border border-gray-400 px-2 py-2 text-center">{it.qty}</td>
                <td className="border border-gray-400 px-2 py-2 text-right">{it.price.toFixed(2)}</td>
                <td className="border border-gray-400 px-2 py-2 text-right font-medium">{it.total.toFixed(2)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="border border-gray-400 px-2 py-2">&nbsp;</td>
                <td className="border border-gray-400 px-2 py-2"></td>
                <td className="border border-gray-400 px-2 py-2"></td>
                <td className="border border-gray-400 px-2 py-2"></td>
                <td className="border border-gray-400 px-2 py-2"></td>
                <td className="border border-gray-400 px-2 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="relative grid grid-cols-2 gap-4 mb-4">
          <div className="text-sm">
            <p className="text-gray-700 mb-1"><strong>Amount In Words:</strong></p>
            <p className="italic">{numberToWords(grandTotal)}</p>
          </div>
          <div className="border border-gray-400">
            <div className="flex justify-between px-3 py-2 border-b border-gray-400 text-sm">
              <span>Subtotal</span>
              <span className="font-medium">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-3 py-2 border-b border-gray-400 text-sm">
              <span>VAT (15%)</span>
              <span className="font-medium">{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-3 py-2 text-base font-bold bg-gray-100">
              <span>Grand Total</span>
              <span>ETB {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="relative flex justify-between text-sm mt-8 pt-4">
          <div>
            <p className="text-gray-600">Customer Signature: _______________________</p>
          </div>
          <div className="text-right">
            <p className="text-gray-600">Authorized Signature: _______________________</p>
          </div>
        </div>

        <p className="relative text-center text-xs text-gray-500 mt-6">
          Thank you for your business!
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default Receipt;