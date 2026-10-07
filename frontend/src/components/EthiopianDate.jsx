import React from 'react';
import { formatEthiopian } from '../utils/ethiopianDate';

/**
 * Displays a date in Ethiopian calendar format.
 * Props:
 *   - date: ISO string or Date object
 *   - showGregorian: also show the Gregorian date below (small gray)
 *   - includeTime: include the time in the Ethiopian display
 */
function EthiopianDate({ date, showGregorian = false, includeTime = false, className = '' }) {
  if (!date) return <span className={className}>—</span>;

  const ethStr = formatEthiopian(date, { amharic: true, includeTime });
  const gregStr = new Date(date).toLocaleString();

  if (!showGregorian) {
    return (
      <span className={className} style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
        {ethStr}
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="block" style={{ fontFamily: "'Noto Sans Ethiopic', sans-serif" }}>
        {ethStr}
      </span>
      <span className="block text-[10px] text-gray-400">{gregStr}</span>
    </span>
  );
}

export default EthiopianDate;