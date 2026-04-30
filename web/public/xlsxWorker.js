/**
 * xlsxWorker.js — Web Worker for parsing Excel/CSV files off the main thread.
 * 
 * The main thread posts:
 *   { type: 'PARSE', payload: { buffer: ArrayBuffer, fileName: string } }
 *
 * The worker posts back:
 *   { type: 'RESULT', payload: { headers: string[], rows: Record<string,string>[], fileName: string } }
 *   { type: 'ERROR',  payload: { message: string } }
 *   { type: 'PROGRESS', payload: { pct: number, message: string } }
 */

// We load SheetJS via importScripts from a CDN.
// This keeps the worker self-contained and avoids bundler complexity.
importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');

self.onmessage = function (evt) {
  const { type, payload } = evt.data;
  if (type !== 'PARSE') return;

  try {
    const { buffer, fileName } = payload;

    self.postMessage({ type: 'PROGRESS', payload: { pct: 10, message: 'Reading file…' } });

    const wb = XLSX.read(buffer, { type: 'array', cellDates: false, dense: false });

    self.postMessage({ type: 'PROGRESS', payload: { pct: 40, message: 'Parsing sheet…' } });

    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];

    self.postMessage({ type: 'PROGRESS', payload: { pct: 60, message: 'Converting to JSON…' } });

    // sheet_to_json returns objects keyed by header name
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    self.postMessage({ type: 'PROGRESS', payload: { pct: 85, message: `Loaded ${rows.length} rows…` } });

    // Extract header order from the sheet range so column order is preserved
    const ref = ws['!ref'];
    let headers = [];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
        const cell = ws[cellAddr];
        headers.push(cell ? String(cell.v) : `Column ${C + 1}`);
      }
    } else if (rows.length > 0) {
      headers = Object.keys(rows[0]);
    }

    self.postMessage({ type: 'PROGRESS', payload: { pct: 100, message: 'Done!' } });

    self.postMessage({
      type: 'RESULT',
      payload: { headers, rows, fileName }
    });

  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: err instanceof Error ? err.message : String(err) }
    });
  }
};
