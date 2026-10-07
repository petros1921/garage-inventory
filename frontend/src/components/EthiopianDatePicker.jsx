import React, { useEffect, useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { toEthiopian, toGregorian, ET_MONTHS_AM } from '../utils/ethiopianDate';

function EthiopianDatePicker({ value, onChange, label = 'Date' }) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  // Sync from external value (Gregorian → Ethiopian)
  useEffect(() => {
    if (value) {
      const eth = toEthiopian(value);
      if (eth) {
        setYear(String(eth.year));
        setMonth(String(eth.month));
        setDay(String(eth.day));
      }
    } else {
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value]);

  const emitChange = (y, m, d) => {
    if (y && m && d) {
      try {
        const g = toGregorian(parseInt(y), parseInt(m), parseInt(d));
        const iso = `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
        onChange(iso);
      } catch {
        onChange('');
      }
    } else {
      onChange('');
    }
  };

  const handleYear = (e) => {
    const v = e.target.value;
    setYear(v);
    emitChange(v, month, day);
  };
  const handleMonth = (e) => {
    const v = e.target.value;
    setMonth(v);
    emitChange(year, v, day);
  };
  const handleDay = (e) => {
    const v = e.target.value;
    setDay(v);
    emitChange(year, month, v);
  };

  const handleClear = () => {
    setYear('');
    setMonth('');
    setDay('');
    onChange('');
  };

  // Ethiopian year range: current year ± 5 (E.C.)
  const nowEth = toEthiopian(new Date());
  const currentEthYear = nowEth?.year || 2019;
  const years = [];
  for (let y = currentEthYear + 5; y >= currentEthYear - 5; y--) years.push(y);

  // Pagume (13th month) has only 5 or 6 days
  const maxDay = parseInt(month) === 13 ? 6 : 30;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const isActive = year && month && day;
  const etFont = { fontFamily: "'Noto Sans Ethiopic', sans-serif" };

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
          <Calendar size={11} /> {label}
        </label>
      )}
      <div className={`flex items-center gap-1 border rounded-lg bg-white px-2 py-1.5 transition ${
        isActive ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-gray-300'
      }`}>
        {/* Year — now in Amharic */}
        <select
          value={year}
          onChange={handleYear}
          className="flex-1 min-w-0 text-sm bg-transparent outline-none cursor-pointer"
          style={etFont}
        >
          <option value="">አመት</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Month */}
        <select
          value={month}
          onChange={handleMonth}
          className="flex-1 min-w-0 text-sm bg-transparent outline-none cursor-pointer"
          style={etFont}
        >
          <option value="">ወር</option>
          {ET_MONTHS_AM.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Day */}
        <select
          value={day}
          onChange={handleDay}
          className="w-14 text-sm bg-transparent outline-none cursor-pointer"
          style={etFont}
        >
          <option value="">ቀን</option>
          {days.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Clear button */}
        {isActive && (
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500 p-0.5 flex-shrink-0"
            title="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {isActive && (
        <p className="text-[10px] text-emerald-600 mt-0.5" style={etFont}>
          ✓ {ET_MONTHS_AM[parseInt(month) - 1]} {day}, {year} ዓ.ም
        </p>
      )}
    </div>
  );
}

export default EthiopianDatePicker;