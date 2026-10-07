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
  return `${birrText} Birr and ${centsText}`;
};

function ProformaPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = user.role;
      if (role === 'manager') navigate('/proformas');
      else navigate('/');
    } catch {
      navigate('/');
    }
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/proformas/${id}`);
        setData(res.data.proforma);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <div className="p-12 text-center">Loading proforma...</div>;
  if (!data) return <div className="p-12 text-center text-red-600">Proforma not found</div>;

  const items = data.items || [];
  const MIN_ROWS = 22;
  const emptyRows = Math.max(0, MIN_ROWS - items.length);

  const etFont = { fontFamily: "'Noto Sans Ethiopic', sans-serif" };

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
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-medium"
        >
          <Printer size={18} /> Print / Save PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white my-6 p-8 shadow print:shadow-none print:my-0 print:p-6">
        <div className="text-center pb-3 mb-2">
          <h1 className="text-lg font-bold leading-tight" style={etFont}>
            ኮከብ ወርቁ ሁለገብ ተሽከርካሪዎች እና የተሸከርካሪ አካላት ጥገና
          </h1>
          <h2 className="text-base font-bold mt-0.5">
            Kokeb Worku Multipurpose Vehicles &amp; Parts Maintenance
          </h2>
          <div className="flex justify-between items-center mt-2 text-xs px-1">
            <span>Supplier's TIN No. <strong>0014264781</strong></span>
            <span>📞 0944 24 8807</span>
          </div>
        </div>

        <div className="text-center my-3">
          <div className="text-base font-bold" style={etFont}>የዋጋ ማቅረቢያ</div>
          <div className="text-base font-bold">PROFORMA INVOICE</div>
        </div>

        <div className="grid grid-cols-2 gap-0 mb-0">
          <div className="border border-gray-800 border-r-0 px-2 py-1 min-h-[70px]">
            <div className="flex items-start">
              <span className="text-sm font-semibold" style={etFont}>ለ</span>
              <span className="text-xs ml-1 mt-1">To</span>
              <span className="text-xs ml-1 mt-1">:</span>
              <span className="ml-2 text-sm font-medium">{data.customer_name || ''}</span>
            </div>
            {data.customer_tin && (
              <div className="text-xs mt-0.5 ml-8">TIN: {data.customer_tin}</div>
            )}
            {data.customer_address && (
              <div className="text-xs mt-0.5 ml-8">{data.customer_address}</div>
            )}
            {data.customer_phone && (
              <div className="text-xs mt-0.5 ml-8">☎ {data.customer_phone}</div>
            )}
          </div>

          <div className="border border-gray-800">
            <div className="flex items-center px-2 py-1 border-b border-gray-800">
              <span className="text-sm font-semibold" style={etFont}>ቀን</span>
              <span className="text-[10px] ml-1">Date</span>
              <span className="flex-1 border-b border-dotted border-gray-500 mx-2"></span>
              <span className="text-xs">
                {data.date ? new Date(data.date).toLocaleDateString() : ''}
              </span>
            </div>
            {data.date && (
              <div className="text-center text-[10px] text-gray-500 pb-0.5">
                <EthiopianDate date={data.date} />
              </div>
            )}
            <div className="flex items-center px-2 py-1 border-t border-gray-800">
              <span className="text-sm font-semibold">№</span>
              <span className="flex-1 border-b border-dotted border-gray-500 mx-2"></span>
              <span className="font-mono text-xs">{data.proforma_number || ''}</span>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-800 py-1 w-10 text-center leading-tight">
                <div style={etFont} className="font-semibold">ተቁ</div>
                <div className="text-[9px] font-normal">No.</div>
              </th>
              <th className="border border-gray-800 py-1 text-center leading-tight">
                <div style={etFont} className="font-semibold">የዕቃው/የአገልግሎቱ ዓይነት</div>
                <div className="text-[9px] font-normal">Description</div>
              </th>
              <th className="border border-gray-800 py-1 w-16 text-center leading-tight">
                <div style={etFont} className="font-semibold">መለኪያ</div>
                <div className="text-[9px] font-normal">Unit</div>
              </th>
              <th className="border border-gray-800 py-1 w-14 text-center leading-tight">
                <div style={etFont} className="font-semibold">ብዛት</div>
                <div className="text-[9px] font-normal">Qty.</div>
              </th>
              <th className="border border-gray-800 py-1 w-20 text-center leading-tight">
                <div style={etFont} className="font-semibold">የንግድ ዋጋ</div>
                <div className="text-[9px] font-normal">Unit Price</div>
              </th>
              <th className="border border-gray-800 py-1 w-24 text-center leading-tight">
                <div style={etFont} className="font-semibold">ጠቅላላ ዋጋ</div>
                <div className="text-[9px] font-normal">Total Amount</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const lineTotal = (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 0);
              return (
                <tr key={i} className="h-6">
                  <td className="border border-gray-800 text-center">{i + 1}</td>
                  <td className="border border-gray-800 px-1">{it.description}</td>
                  <td className="border border-gray-800 text-center">{it.unit || 'PCS'}</td>
                  <td className="border border-gray-800 text-center">{it.qty}</td>
                  <td className="border border-gray-800 text-right px-1">
                    {(parseFloat(it.price) || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-800 text-right px-1">
                    {lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-6">
                <td className="border border-gray-800">&nbsp;</td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-0 mt-0">
          <div className="border border-gray-800 border-r-0 border-t-0 px-2 py-2 min-h-[90px]">
            <div className="text-[10px] font-semibold" style={etFont}>የግልጽ ለክ በፊደል</div>
            <div className="text-[10px] font-semibold">Amount In words</div>
            <div className="text-xs mt-1 italic">
              {data.total ? numberToWords(parseFloat(data.total)) : ''}
            </div>
          </div>

          <div className="border border-gray-800 border-t-0">
            <div className="flex items-center border-b border-gray-800">
              <div className="flex-1 px-2 py-1.5">
                <div className="text-xs font-semibold" style={etFont}>ድምር</div>
                <div className="text-[9px]">Total</div>
              </div>
              <div className="w-28 px-2 py-1.5 text-right font-medium">
                {(parseFloat(data.subtotal) || 0).toFixed(2)}
              </div>
            </div>
            <div className="flex items-center border-b border-gray-800">
              <div className="flex-1 px-2 py-1.5">
                <div className="text-xs font-semibold" style={etFont}>ተ.እ.ታ</div>
                <div className="text-[9px]">VAT 15%</div>
              </div>
              <div className="w-28 px-2 py-1.5 text-right font-medium">
                {(parseFloat(data.vat_amount) || 0).toFixed(2)}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex-1 px-2 py-1.5">
                <div className="text-xs font-semibold" style={etFont}>ጠቅላላ ድምር</div>
                <div className="text-[9px]">Total Included Vat</div>
              </div>
              <div className="w-28 px-2 py-1.5 text-right font-bold">
                {(parseFloat(data.total) || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-gray-800 border-t-0 px-2 py-3 space-y-3">
          <div className="flex items-end gap-2 text-xs">
            <div className="flex-shrink-0">
              <div className="text-[10px] font-semibold" style={etFont}>
                ይህ ዋጋ ማቅረቢያ ዋጋ የሚኖረው
              </div>
              <div className="text-[10px]">This Proforma is Valid for</div>
            </div>
            <div className="flex-1 border-b border-dotted border-gray-500 mx-2 mb-1">
              <span className="text-xs">
                {data.valid_until ? new Date(data.valid_until).toLocaleDateString() : ''}
              </span>
              {data.valid_until && (
                <span className="block text-[9px] text-gray-500">
                  <EthiopianDate date={data.valid_until} />
                </span>
              )}
            </div>
            <div className="flex-shrink-0 pb-0.5">
              <div className="text-[10px] font-semibold" style={etFont}>ብቻ ነው</div>
              <div className="text-[10px]">Only</div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 text-xs">
            <div className="flex items-end gap-2 flex-1">
              <div className="flex-shrink-0">
                <div className="text-[10px] font-semibold" style={etFont}>የማስረከቢያ ቀን</div>
                <div className="text-[10px]">Delivery Date</div>
              </div>
              <div className="flex-1 border-b border-dotted border-gray-500 mx-2 mb-1">
                <span className="text-xs">
                  {data.delivery_date ? new Date(data.delivery_date).toLocaleDateString() : ''}
                </span>
                {data.delivery_date && (
                  <span className="block text-[9px] text-gray-500">
                    <EthiopianDate date={data.delivery_date} />
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-end gap-2 flex-1">
              <div className="flex-shrink-0">
                <div className="text-[10px] font-semibold" style={etFont}>ፈርሚ</div>
                <div className="text-[10px]">Sig.</div>
              </div>
              <div className="flex-1 border-b border-dotted border-gray-500 mx-2 mb-1 min-h-[16px]"></div>
            </div>
          </div>

          {data.notes && (
            <div className="text-[10px] pt-2 border-t border-dashed border-gray-400">
              <span className="font-semibold">Notes:</span> {data.notes}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default ProformaPrint;