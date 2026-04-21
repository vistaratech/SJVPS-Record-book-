// Firestore-backed API client for RecordBook Web
import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { TEMPLATES, type Template, type TemplateColumn } from './templates';

// ==================== AUTH ====================
export interface User {
  id: number;
  phone: string;
  name: string | null;
  createdAt: string;
}

export interface SendOtpResponse { message: string; devOtp?: string; }
export interface VerifyOtpResponse { token: string; user: User; }

export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  void phone;
  return { message: 'OTP sent', devOtp: '123456' };
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  void otp;
  return {
    token: 'mock-token',
    user: { id: 1, phone, name: 'Test User', createdAt: new Date().toISOString() },
  };
}

export async function getMe(): Promise<User> {
  return { id: 1, phone: '9999999999', name: 'Test User', createdAt: new Date().toISOString() };
}

// ==================== BUSINESSES ====================
export interface Business { id: number; name: string; ownerId: number; createdAt: string; }

const businessesCol = () => collection(db, 'businesses');

export async function listBusinesses(): Promise<Business[]> {
  const snap = await getDocs(businessesCol());
  return snap.docs.map(d => d.data() as Business);
}

export async function createBusiness(name: string): Promise<Business> {
  const bus: Business = { id: Date.now(), name, ownerId: 1, createdAt: new Date().toISOString() };
  await setDoc(doc(db, 'businesses', bus.id.toString()), bus);
  return bus;
}

// ==================== REGISTERS ====================
export interface RegisterSummary {
  id: number; businessId: number; name: string; icon: string; iconColor?: string;
  category: string; template: string; createdAt: string; updatedAt: string; entryCount: number;
  lastActivity?: string;
}

export interface Column {
  id: number; registerId: number; name: string; type: string; position: number;
  dropdownOptions?: string[]; formula?: string;
}

export interface Entry {
  id: number; registerId: number; rowNumber: number;
  cells: Record<string, string>; createdAt: string; pageIndex?: number;
}

export interface Page { id: number; name: string; index: number; }

export interface RegisterDetail extends RegisterSummary {
  columns: Column[]; entries: Entry[]; pages: Page[];
  shareLink?: string; sharedWith?: SharedUser[];
}

export interface SharedUser {
  id: number; name: string; phone: string; permission: 'view' | 'edit'; addedAt: string;
}

// ── Firestore helpers ────────────────────────────────────────────────────────
const registersCol = () => collection(db, 'registers');
const regDoc = (id: number) => doc(db, 'registers', id.toString());

async function getRegDoc(registerId: number): Promise<RegisterDetail> {
  const snap = await getDoc(regDoc(registerId));
  if (!snap.exists()) throw new Error('Register not found');
  return snap.data() as RegisterDetail;
}

async function saveRegDoc(reg: RegisterDetail): Promise<void> {
  await setDoc(regDoc(reg.id), JSON.parse(JSON.stringify(reg)));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function listRegisters(businessId: number): Promise<RegisterSummary[]> {
  const q = query(registersCol(), where('businessId', '==', businessId));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const r = d.data() as RegisterDetail;
    return {
      id: r.id, businessId: r.businessId, name: r.name, icon: r.icon, iconColor: r.iconColor,
      category: r.category, template: r.template, createdAt: r.createdAt, updatedAt: r.updatedAt,
      entryCount: (r.entries || []).length,
      lastActivity: (r.entries || []).length > 0
        ? (Object.values((r.entries || [])[r.entries.length - 1]?.cells || {}).filter(Boolean).slice(0, 2).join(', '))
        : '',
    };
  });
}

export async function getRegister(registerId: number): Promise<RegisterDetail> {
  const reg = await getRegDoc(registerId);
  if (!reg.pages || reg.pages.length === 0) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  if (!reg.entries) reg.entries = [];
  if (!reg.columns) reg.columns = [];
  return reg;
}

export async function createRegister(data: {
  businessId: number; name: string; icon?: string; iconColor?: string;
  category?: string; template?: string;
  columns?: Array<{ name: string; type: string; dropdownOptions?: string[]; formula?: string }>;
}): Promise<RegisterSummary> {
  const newId = Date.now();
  const newReg: RegisterDetail = {
    id: newId, businessId: data.businessId, name: data.name,
    icon: data.icon || 'file-text', iconColor: data.iconColor,
    category: data.category || 'general', template: data.template || data.name,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: 0,
    columns: (data.columns || []).map((c, i) => ({
      id: newId + i + 1, registerId: newId, name: c.name, type: c.type,
      position: i, dropdownOptions: c.dropdownOptions, formula: c.formula,
    })),
    entries: [], pages: [{ id: 1, name: 'Page 1', index: 0 }], sharedWith: [],
  };
  if (newReg.columns.length > 0) {
    for (let i = 0; i < 3; i++) {
      newReg.entries.push({
        id: newId + 5000 + i, registerId: newId, rowNumber: i + 1,
        cells: {}, createdAt: new Date().toISOString(), pageIndex: 0,
      });
    }
    newReg.entryCount = 3;
  }
  await saveRegDoc(newReg);
  return newReg;
}

export async function deleteRegister(registerId: number): Promise<void> {
  await deleteDoc(regDoc(registerId));
}

export async function renameRegister(registerId: number, newName: string): Promise<RegisterSummary> {
  const reg = await getRegDoc(registerId);
  reg.name = newName;
  reg.updatedAt = new Date().toISOString();
  await saveRegDoc(reg);
  return reg;
}

export async function duplicateRegister(registerId: number): Promise<RegisterSummary> {
  const reg = await getRegDoc(registerId);
  const newId = Date.now();
  const duplicated: RegisterDetail = {
    ...JSON.parse(JSON.stringify(reg)), id: newId, name: `${reg.name} (Copy)`,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: reg.entries.length,
  };
  duplicated.columns = duplicated.columns.map((c: Column, i: number) => ({ ...c, id: newId + i + 1, registerId: newId }));
  duplicated.entries = duplicated.entries.map((e: Entry, i: number) => ({ ...e, id: newId + 1000 + i, registerId: newId }));
  duplicated.pages = duplicated.pages.map((p: Page, i: number) => ({ ...p, id: newId + 2000 + i }));
  await saveRegDoc(duplicated);
  return duplicated;
}

export const importExcelData = async (businessId: number, name: string, data: Record<string, string | number | boolean | null>[]): Promise<RegisterSummary> => {
  if (!data || data.length === 0) throw new Error("No data found in the spreadsheet");

  const headers = Object.keys(data[0]);

  let bestTemplate: Template | null = null;
  let maxMatches = 0;
  for (const cat in TEMPLATES) {
    for (const tpl of TEMPLATES[cat]) {
      const matchCount = tpl.columns.filter(c => headers.includes(c.name)).length;
      if (matchCount > maxMatches && matchCount >= 2) {
         maxMatches = matchCount;
         bestTemplate = tpl;
      }
    }
  }

  const columns = headers.map((h, i) => {
    const tplCol = bestTemplate?.columns.find((c: TemplateColumn) => c.name === h);
    return {
      name: h || `Column ${i + 1}`,
      type: tplCol?.type || 'text',
      dropdownOptions: tplCol?.dropdownOptions,
      formula: tplCol?.formula,
    };
  });

  const createdReg = await createRegister({ businessId, name, columns });

  // Re-fetch the full register to populate entries
  const reg = await getRegDoc(createdReg.id);
  reg.entries = [];

  data.forEach((row, rowIndex) => {
    const cells: Record<string, string> = {};
    headers.forEach((h, colIndex) => {
      const val = row[h];
      if (val !== undefined && val !== null && val !== '') {
        cells[reg.columns[colIndex].id.toString()] = String(val);
      }
    });

    reg.entries.push({
      id: Date.now() + rowIndex * 10,
      registerId: reg.id,
      rowNumber: rowIndex + 1,
      cells,
      createdAt: new Date().toISOString(),
      pageIndex: 0,
    });
  });

  reg.entryCount = reg.entries.length;
  await saveRegDoc(reg);
  return reg;
};

// ─── Formula Engine ──────────────────────────────────────────────────────────
// Supports: {Column Name} references, +  -  *  /  ()  ^  %  Math functions

function parseAndEval(expr: string): number {
  expr = expr.trim();
  let pos = 0;

  function peek(): string { return expr[pos] || ''; }
  function consume(): string { return expr[pos++] || ''; }
  function skipWS() { while (pos < expr.length && expr[pos] === ' ') pos++; }

  function parseExpr(): number { return parseAddSub(); }

  function parseAddSub(): number {
    let left = parseMulDiv();
    skipWS();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      skipWS();
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
      skipWS();
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = parsePow();
    skipWS();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      skipWS();
      const right = parsePow();
      if (op === '/' && right === 0) return NaN;
      left = op === '*' ? left * right : left / right;
      skipWS();
    }
    return left;
  }

  function parsePow(): number {
    const base = parseUnary();
    skipWS();
    if (peek() === '^') {
      consume();
      skipWS();
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    skipWS();
    if (peek() === '-') { consume(); return -parsePrimary(); }
    if (peek() === '+') { consume(); return parsePrimary(); }
    return parsePrimary();
  }

  function parseNumber(): number {
    let num = '';
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) { num += consume(); }
    return parseFloat(num) || 0;
  }

  const MATH_FNS: Record<string, (a: number) => number> = {
    abs: Math.abs, sqrt: Math.sqrt, ceil: Math.ceil, floor: Math.floor,
    round: Math.round, log: Math.log, log10: Math.log10,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
  };

  function parsePrimary(): number {
    skipWS();
    if (peek() === '(') {
      consume();
      const val = parseExpr();
      skipWS();
      if (peek() === ')') consume();
      return val;
    }
    if (/[a-zA-Z]/.test(peek())) {
      let name = '';
      while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) { name += consume(); }
      skipWS();
      if (peek() === '(') {
        consume();
        const arg = parseExpr();
        skipWS();
        if (peek() === ')') consume();
        const fn = MATH_FNS[name.toLowerCase()];
        if (fn) return fn(arg);
        return 0;
      }
      return 0;
    }
    return parseNumber();
  }

  return parseExpr();
}

export function evaluateFormula(formula: string, entry: Entry, columns: Column[]): string {
  if (!formula || formula.trim() === '') return '';
  try {
    const sorted = [...columns].sort((a, b) => b.name.length - a.name.length);
    let expression = formula;
    for (const col of sorted) {
      const escaped = col.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('\\{' + escaped + '\\}', 'gi');
      const rawVal = entry.cells?.[col.id.toString()] ?? '';
      let numStr: string;
      if (col.type === 'formula' && col.formula) {
        const nested = evaluateFormula(col.formula, entry, columns);
        numStr = (nested === 'ERR' || nested === '') ? '0' : nested;
      } else {
        const parsed = parseFloat(rawVal);
        numStr = isNaN(parsed) ? '0' : parsed.toString();
      }
      expression = expression.replace(regex, numStr);
    }
    expression = expression.replace(/\{[^}]*\}/g, '0');
    expression = expression.trim();
    if (expression === '') return '';
    const result = parseAndEval(expression);
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      if (Number.isInteger(result)) return result.toString();
      const fixed = parseFloat(result.toFixed(2));
      return fixed.toString();
    }
    return 'ERR';
  } catch {
    return 'ERR';
  }
}


// ─── Column Operations ──────────────────────────────────────────────────────

export async function addColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col: Column = {
    id: Date.now(), registerId, name: data.name, type: data.type,
    position: reg.columns.length, dropdownOptions: data.dropdownOptions, formula: data.formula,
  };
  reg.columns.push(col);
  await saveRegDoc(reg);
  return col;
}

export async function deleteColumn(registerId: number, columnId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  reg.columns = reg.columns.filter((c) => c.id !== columnId);
  await saveRegDoc(reg);
}

export async function renameColumn(registerId: number, columnId: number, newName: string): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  col.name = newName;
  await saveRegDoc(reg);
  return col;
}

export async function updateColumnDropdownOptions(registerId: number, columnId: number, options: string[]): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  col.dropdownOptions = options;
  await saveRegDoc(reg);
  return col;
}

export async function duplicateColumn(registerId: number, columnId: number): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const original = reg.columns.find((c) => c.id === columnId);
  if (!original) throw new Error('Column not found');
  const newCol: Column = {
    id: Date.now(), registerId, name: `${original.name} (Copy)`, type: original.type,
    position: reg.columns.length, dropdownOptions: original.dropdownOptions ? [...original.dropdownOptions] : undefined,
    formula: original.formula,
  };
  reg.columns.push(newCol);
  reg.entries.forEach((entry) => {
    const val = entry.cells?.[columnId.toString()];
    if (val) entry.cells[newCol.id.toString()] = val;
  });
  await saveRegDoc(reg);
  return newCol;
}

export async function moveColumn(registerId: number, columnId: number, direction: 'left' | 'right'): Promise<void> {
  const reg = await getRegDoc(registerId);
  const idx = reg.columns.findIndex((c) => c.id === columnId);
  if (idx === -1) throw new Error('Column not found');
  const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= reg.columns.length) return;
  [reg.columns[idx], reg.columns[targetIdx]] = [reg.columns[targetIdx], reg.columns[idx]];
  reg.columns.forEach((c, i) => c.position = i);
  await saveRegDoc(reg);
}

export async function changeColumnType(registerId: number, columnId: number, newType: string): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  col.type = newType;
  if (newType !== 'dropdown') col.dropdownOptions = undefined;
  if (newType !== 'formula') col.formula = undefined;
  await saveRegDoc(reg);
  return col;
}

export async function clearColumnData(registerId: number, columnId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  const colIdStr = columnId.toString();
  reg.entries.forEach((entry) => {
    if (entry.cells && entry.cells[colIdStr] !== undefined) {
      delete entry.cells[colIdStr];
    }
  });
  await saveRegDoc(reg);
}

export async function insertColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }, position: number): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col: Column = {
    id: Date.now(), registerId, name: data.name, type: data.type,
    position, dropdownOptions: data.dropdownOptions, formula: data.formula,
  };
  reg.columns.splice(position, 0, col);
  reg.columns.forEach((c, i) => c.position = i);
  await saveRegDoc(reg);
  return col;
}

export async function freezeColumn(registerId: number, columnId: number, frozen: boolean): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  (col as Column & { frozen: boolean }).frozen = frozen;
  await saveRegDoc(reg);
  return col;
}

export async function hideColumn(registerId: number, columnId: number, hidden: boolean): Promise<Column> {
  const reg = await getRegDoc(registerId);
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  (col as Column & { hidden: boolean }).hidden = hidden;
  await saveRegDoc(reg);
  return col;
}

// ─── Entry Operations ────────────────────────────────────────────────────────

export async function addEntry(registerId: number, cells: Record<string, string> = {}, pageIndex: number = 0): Promise<Entry> {
  const reg = await getRegDoc(registerId);
  const pageEntries = reg.entries.filter((e) => (e.pageIndex || 0) === pageIndex);
  const entry: Entry = {
    id: Date.now(), registerId, rowNumber: pageEntries.length + 1,
    cells, createdAt: new Date().toISOString(), pageIndex,
  };
  reg.entries.push(entry);
  reg.entryCount = reg.entries.length;
  reg.updatedAt = new Date().toISOString();
  await saveRegDoc(reg);
  return entry;
}

export async function updateEntry(registerId: number, entryId: number, cells: Record<string, string>): Promise<Entry> {
  const reg = await getRegDoc(registerId);
  const entry = reg.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('Entry not found');
  entry.cells = { ...entry.cells, ...cells };
  reg.updatedAt = new Date().toISOString();
  await saveRegDoc(reg);
  return entry;
}

export async function deleteEntry(registerId: number, entryId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  reg.entries = reg.entries.filter((e) => e.id !== entryId);
  reg.entryCount = reg.entries.length;
  await saveRegDoc(reg);
}

export async function duplicateEntry(registerId: number, entryId: number): Promise<Entry> {
  const reg = await getRegDoc(registerId);
  const original = reg.entries.find((e) => e.id === entryId);
  if (!original) throw new Error('Entry not found');
  const duplicate: Entry = {
    id: Date.now(), registerId, rowNumber: reg.entries.length + 1,
    cells: { ...original.cells }, createdAt: new Date().toISOString(), pageIndex: original.pageIndex,
  };
  reg.entries.push(duplicate);
  reg.entryCount = reg.entries.length;
  await saveRegDoc(reg);
  return duplicate;
}

export async function bulkDeleteEntries(registerId: number, entryIds: number[]): Promise<void> {
  const reg = await getRegDoc(registerId);
  reg.entries = reg.entries.filter((e) => !entryIds.includes(e.id));
  reg.entryCount = reg.entries.length;
  await saveRegDoc(reg);
}

// ─── Page Operations ─────────────────────────────────────────────────────────

export async function addPage(registerId: number, pageName?: string): Promise<Page> {
  const reg = await getRegDoc(registerId);
  if (!reg.pages) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  const newPage: Page = { id: Date.now(), name: pageName || `Page ${reg.pages.length + 1}`, index: reg.pages.length };
  reg.pages.push(newPage);
  await saveRegDoc(reg);
  return newPage;
}

export async function renamePage(registerId: number, pageId: number, newName: string): Promise<Page> {
  const reg = await getRegDoc(registerId);
  const page = reg.pages?.find((p) => p.id === pageId);
  if (!page) throw new Error('Page not found');
  page.name = newName;
  await saveRegDoc(reg);
  return page;
}

export async function deletePage(registerId: number, pageId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  if (!reg.pages || reg.pages.length <= 1) throw new Error('Cannot delete the only page');
  const pageIndex = reg.pages.findIndex((p) => p.id === pageId);
  reg.pages = reg.pages.filter((p) => p.id !== pageId);
  reg.entries = reg.entries.filter((e) => (e.pageIndex || 0) !== pageIndex);
  reg.entryCount = reg.entries.length;
  await saveRegDoc(reg);
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

export async function generateShareLink(registerId: number): Promise<string> {
  const reg = await getRegDoc(registerId);
  const link = `https://rekord.app/share/${registerId}/${Date.now().toString(36)}`;
  reg.shareLink = link;
  await saveRegDoc(reg);
  return link;
}

export async function addSharedUser(registerId: number, phone: string, permission: 'view' | 'edit'): Promise<SharedUser> {
  const reg = await getRegDoc(registerId);
  if (!reg.sharedWith) reg.sharedWith = [];
  const user: SharedUser = {
    id: Date.now(), name: `User ${phone.slice(-4)}`, phone, permission, addedAt: new Date().toISOString(),
  };
  reg.sharedWith.push(user);
  await saveRegDoc(reg);
  return user;
}

export async function removeSharedUser(registerId: number, userId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  if (reg.sharedWith) reg.sharedWith = reg.sharedWith.filter((u) => u.id !== userId);
  await saveRegDoc(reg);
}

// ─── Utilities (pure, no DB) ─────────────────────────────────────────────────

/** Manually trigger a save — kept for Ctrl+S compat (now a no-op since data is always in Firestore) */
export function saveToStorage(): boolean {
  return true;
}

export function generateCSV(register: RegisterDetail, pageIndex: number = 0): string {
  const cols = register.columns;
  const entries = register.entries.filter((e) => (e.pageIndex || 0) === pageIndex);
  const headers = ['S.No.', ...cols.map((c) => c.name)];
  const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
  const dataRows = entries.map((entry, idx) => {
    const row = [(idx + 1).toString(), ...cols.map((col) => {
      const val = entry.cells?.[col.id.toString()] || '';
      return `"${val.replace(/"/g, '""')}"`;
    })];
    return row.join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

export interface ColumnStats { sum: number; average: number; count: number; min: number; max: number; filled: number; }

export function calculateColumnStats(entries: Entry[], columnId: string): ColumnStats {
  const values = entries.map((e) => e.cells?.[columnId]).filter((v) => v !== undefined && v !== null && v !== '');
  const numbers = values.map((v) => parseFloat(v!)).filter((n) => !isNaN(n));
  return {
    sum: numbers.reduce((a, b) => a + b, 0),
    average: numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0,
    count: values.length, min: numbers.length > 0 ? Math.min(...numbers) : 0,
    max: numbers.length > 0 ? Math.max(...numbers) : 0, filled: values.length,
  };
}
