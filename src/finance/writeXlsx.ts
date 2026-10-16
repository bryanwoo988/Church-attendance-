import type { Sheet } from '../../shared/export';

/** Build and download an .xlsx in the browser. ExcelJS is loaded only when needed. */
export async function downloadXlsx(sheets: Sheet[], filename: string): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Church Check-in';
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    s.rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    const header = s.rows[0] ?? [];
    header.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.max(12, String(h).length + 4);
      if (String(h).includes('RM')) col.numFmt = '#,##0.00';
      if (String(h).includes('Rate')) col.numFmt = '0%';
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
