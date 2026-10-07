import * as XLSX from 'xlsx';

/**
 * Export an array of objects to an .xlsx file.
 * @param {Array} data - array of plain objects
 * @param {String} filename - base name without extension
 * @param {String} sheetName - sheet name
 * @param {Object} headers - optional { key: 'Column Label' } map for nice column titles
 */
export const exportToExcel = (data, filename, sheetName = 'Data', headers = null) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  let exportData = data;
  if (headers) {
    exportData = data.map(row => {
      const mapped = {};
      Object.entries(headers).forEach(([key, label]) => {
        mapped[label] = row[key];
      });
      return mapped;
    });
  }

  const ws = XLSX.utils.json_to_sheet(exportData);

  // Auto-fit column widths
  const keys = Object.keys(exportData[0] || {});
  ws['!cols'] = keys.map(k => ({
    wch: Math.min(50, Math.max(k.length, ...exportData.map(r => String(r[k] ?? '').length)) + 2),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};