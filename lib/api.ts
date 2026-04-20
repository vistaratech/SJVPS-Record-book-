// Mock API client for RecordBook frontend testing
// Using in-memory storage to bypass need for a backend
import { TEMPLATES } from './templates';

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
}

// ==================== IN-MEMORY DB ====================
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let DB = {
  businesses: [] as Business[],
  registers: [] as RegisterDetail[],
};

// Seed generic DB with an empty array
if (DB.businesses.length === 0) {
  // we will auto-create one from home.tsx
}

// ==================== AUTH ====================
export interface User {
  id: number;
  phone: string;
  name: string | null;
  createdAt: string;
}

export interface SendOtpResponse {
  message: string;
  devOtp?: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: User;
}

export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  await delay(500);
  return { message: 'OTP sent', devOtp: '123456' };
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  await delay(500);
  return {
    token: 'mock-token',
    user: { id: 1, phone, name: 'Test User', createdAt: new Date().toISOString() },
  };
}

export async function getMe(): Promise<User> {
  await delay(300);
  return { id: 1, phone: '9999999999', name: 'Test User', createdAt: new Date().toISOString() };
}

// ==================== BUSINESSES ====================
export interface Business {
  id: number;
  name: string;
  ownerId: number;
  createdAt: string;
}

export async function listBusinesses(): Promise<Business[]> {
  await delay(300);
  return DB.businesses;
}

export async function createBusiness(name: string): Promise<Business> {
  await delay(300);
  const bus: Business = {
    id: Date.now(),
    name,
    ownerId: 1,
    createdAt: new Date().toISOString(),
  };
  DB.businesses.push(bus);
  return bus;
}

// ==================== REGISTERS ====================
export interface RegisterSummary {
  id: number;
  businessId: number;
  name: string;
  icon: string;
  iconColor?: string;
  category: string;
  template: string;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  lastActivity?: string;
}

export interface Column {
  id: number;
  registerId: number;
  name: string;
  type: string;
  position: number;
  dropdownOptions?: string[];  // For dropdown-type columns
  formula?: string;            // For formula-type columns, e.g. "{Marks}/{Full Marks}*100"
}

export interface Entry {
  id: number;
  registerId: number;
  rowNumber: number;
  cells: Record<string, string>;
  createdAt: string;
  pageIndex?: number;  // Multi-page support
}

export interface Page {
  id: number;
  name: string;
  index: number;
}

export interface RegisterDetail extends RegisterSummary {
  columns: Column[];
  entries: Entry[];
  pages: Page[];
  shareLink?: string;
  sharedWith?: SharedUser[];
}

export interface SharedUser {
  id: number;
  name: string;
  phone: string;
  permission: 'view' | 'edit';
  addedAt: string;
}

export async function listRegisters(businessId: number): Promise<RegisterSummary[]> {
  await delay(400);
  return DB.registers.filter((r) => r.businessId === businessId).map((r) => ({
    id: r.id,
    businessId: r.businessId,
    name: r.name,
    icon: r.icon,
    category: r.category,
    template: r.template,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    entryCount: r.entries.length,
    lastActivity: r.entries.length > 0 ? (r.entries[r.entries.length - 1].cells ? Object.values(r.entries[r.entries.length - 1].cells).filter(Boolean).slice(0, 2).join(', ') : '') : '',
  }));
}

export async function getRegister(registerId: number): Promise<RegisterDetail> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  // Ensure pages exist
  if (!reg.pages || reg.pages.length === 0) {
    reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  }
  return reg;
}

export async function createRegister(data: {
  businessId: number;
  name: string;
  icon?: string;
  iconColor?: string;
  category?: string;
  template?: string;
  columns?: Array<{ name: string; type: string; dropdownOptions?: string[]; formula?: string }>;
}): Promise<RegisterSummary> {
  await delay(500);
  const newReg: RegisterDetail = {
    id: Date.now(),
    businessId: data.businessId,
    name: data.name,
    icon: data.icon || 'document',
    iconColor: data.iconColor,
    category: data.category || 'general',
    template: data.template || data.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entryCount: 0,
    columns: (data.columns || []).map((c, i) => ({
      id: Date.now() + i,
      registerId: Date.now(),
      name: c.name,
      type: c.type,
      position: i,
      dropdownOptions: c.dropdownOptions,
      formula: c.formula,
    })),
    entries: [],
    pages: [{ id: 1, name: 'Page 1', index: 0 }],
    sharedWith: [],
  };
  
  // Update registerId in columns to actual id
  newReg.columns.forEach((c) => c.registerId = newReg.id);
  
  // Auto-create 3 blank entries if register has columns (template-based)
  // This way the user can immediately start typing without needing to press "Add Entry"
  if (newReg.columns.length > 0) {
    for (let i = 0; i < 3; i++) {
      newReg.entries.push({
        id: newReg.id + 5000 + i,
        registerId: newReg.id,
        rowNumber: i + 1,
        cells: {},
        createdAt: new Date().toISOString(),
        pageIndex: 0,
      });
    }
    newReg.entryCount = 3;
  }
  
  DB.registers.push(newReg);
  return newReg; // RegisterSummary requires same fields, cast implicitly
}

export async function deleteRegister(registerId: number): Promise<void> {
  await delay(400);
  DB.registers = DB.registers.filter((r) => r.id !== registerId);
}

// ==================== NEW: RENAME REGISTER ====================
export async function renameRegister(registerId: number, newName: string): Promise<RegisterSummary> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  reg.name = newName;
  reg.updatedAt = new Date().toISOString();
  return reg;
}

// ==================== NEW: DUPLICATE REGISTER ====================
export async function duplicateRegister(registerId: number): Promise<RegisterSummary> {
  await delay(500);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const newId = Date.now();
  const duplicated: RegisterDetail = {
    ...JSON.parse(JSON.stringify(reg)),
    id: newId,
    name: `${reg.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entryCount: reg.entries.length,
  };
  // Reassign IDs for columns, entries, pages
  duplicated.columns = duplicated.columns.map((c: Column, i: number) => ({ ...c, id: newId + i + 1, registerId: newId }));
  duplicated.entries = duplicated.entries.map((e: Entry, i: number) => ({ ...e, id: newId + 1000 + i, registerId: newId }));
  duplicated.pages = duplicated.pages.map((p: Page, i: number) => ({ ...p, id: newId + 2000 + i }));
  
  DB.registers.push(duplicated);
  return duplicated;
}

// ==================== NEW: IMPORT DATA ====================
export async function importData(businessId: number, jsonData: string): Promise<Record<string, number>> {
  await delay(1000);
  let parsed: any[];
  try {
    parsed = JSON.parse(jsonData);
    if (!Array.isArray(parsed)) throw new Error('Data must be a JSON array of registers');
  } catch (err) {
    throw new Error('Invalid JSON format');
  }

  let importedCount = 0;
  for (const reg of parsed) {
    const newId = Date.now() + Math.floor(Math.random() * 10000);
    const newReg: RegisterDetail = {
      id: newId,
      businessId,
      name: reg.name || 'Imported Register',
      icon: reg.icon || 'document',
      iconColor: reg.iconColor,
      category: reg.category || 'general',
      template: reg.template || reg.name || 'Import',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entryCount: Array.isArray(reg.entries) ? reg.entries.length : 0,
      columns: [],
      entries: [],
      pages: [{ id: newId + 2000, name: 'Page 1', index: 0 }],
      sharedWith: [],
    };

    if (Array.isArray(reg.columns)) {
      newReg.columns = reg.columns.map((c: any, i: number) => ({
        id: newId + 100 + i,
        registerId: newId,
        name: c.name || `Column ${i+1}`,
        type: c.type || 'text',
        position: i,
        dropdownOptions: c.dropdownOptions,
        formula: c.formula,
      }));
    }

    if (Array.isArray(reg.entries)) {
      newReg.entries = reg.entries.map((e: any, i: number) => {
        // Map old cell IDs to new cell IDs if possible by names. 
        // For simplicity, assuming the import data either matches column names or uses the exact same format
        const newCells: Record<string, string> = {};
        
        // If the import has cells mapped by column name, we can do this mapping:
        if (e.cells) {
          for (const [key, value] of Object.entries(e.cells)) {
            // Find if 'key' is a name of a column, or just assume the column mapping is ordered
            const matchedCol = newReg.columns.find(c => c.name === key || c.name.toLowerCase() === key.toLowerCase() || c.id.toString() === key);
            if (matchedCol) {
              newCells[matchedCol.id.toString()] = value as string;
            } else {
              newCells[key] = value as string; // Fallback
            }
          }
        }

        return {
          id: newId + 5000 + i,
          registerId: newId,
          rowNumber: i + 1,
          cells: newCells,
          createdAt: new Date().toISOString(),
          pageIndex: 0,
        };
      });
      newReg.entryCount = newReg.entries.length;
    }
    
    DB.registers.push(newReg);
    importedCount++;
  }
  
  return { importedCount: parsed.length };
}

// ==================== NEW: IMPORT EXCEL DATA ====================
export const importExcelData = async (businessId: number, name: string, data: Record<string, any>[]): Promise<RegisterSummary> => {
  await delay(500);
  if (!data || data.length === 0) throw new Error("No data found in the spreadsheet");

  // Extract columns from the first row's keys
  const headers = Object.keys(data[0]);
  
  let bestTemplate: any = null;
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
    const tplCol = bestTemplate?.columns.find((c: any) => c.name === h);
    return {
      name: h || `Column ${i + 1}`,
      type: tplCol?.type || 'text',
      dropdownOptions: tplCol?.dropdownOptions,
      formula: tplCol?.formula,
    };
  });

  const createdReg = await createRegister({
    businessId,
    name: name,
    columns
  });

  const reg = DB.registers.find(r => r.id === createdReg.id);
  if (!reg) throw new Error("Failed to initialize register");

  // Clear mock entries generated by createRegister
  reg.entries = [];

  // Map each row to an entry
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
  return reg;
};

// ==================== COLUMNS ====================
// ─── Formula Engine ──────────────────────────────────────────────────────────
// Supports: {Column Name} references, + - * / () ^ Math functions
// Handles: spaces in names, case-insensitive match, chained formulas,
//          longer-name-first replacement, division-by-zero guard

function parseAndEval(expr: string): number {
  expr = expr.trim();
  let pos = 0;

  function peek(): string { return expr[pos] || ''; }
  function consume(): string { return expr[pos++] || ''; }
  function skipWS() { while (pos < expr.length && expr[pos] === ' ') pos++; }
  function parseExpr(): number { return parseAddSub(); }

  function parseAddSub(): number {
    let left = parseMulDiv(); skipWS();
    while (peek() === '+' || peek() === '-') {
      const op = consume(); skipWS();
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
      skipWS();
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = parsePow(); skipWS();
    while (peek() === '*' || peek() === '/') {
      const op = consume(); skipWS();
      const right = parsePow();
      if (op === '/' && right === 0) return NaN;
      left = op === '*' ? left * right : left / right;
      skipWS();
    }
    return left;
  }

  function parsePow(): number {
    const base = parseUnary(); skipWS();
    if (peek() === '^') { consume(); skipWS(); return Math.pow(base, parseUnary()); }
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
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) num += consume();
    return parseFloat(num) || 0;
  }

  const MATH_FNS: Record<string, (a: number) => number> = {
    abs: Math.abs, sqrt: Math.sqrt, ceil: Math.ceil, floor: Math.floor,
    round: Math.round, log: Math.log, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  };

  function parsePrimary(): number {
    skipWS();
    if (peek() === '(') {
      consume();
      const val = parseExpr();
      skipWS(); if (peek() === ')') consume();
      return val;
    }
    if (/[a-zA-Z]/.test(peek())) {
      let name = '';
      while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) name += consume();
      skipWS();
      if (peek() === '(') {
        consume();
        const arg = parseExpr();
        skipWS(); if (peek() === ')') consume();
        const fn = MATH_FNS[name.toLowerCase()];
        return fn ? fn(arg) : 0;
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
    // Replace {Column Name} longest-first to avoid partial matches
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

    // Replace any unresolved {…} references with 0
    expression = expression.replace(/\{[^}]*\}/g, '0').trim();
    if (expression === '') return '';

    const result = parseAndEval(expression);
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      if (Number.isInteger(result)) return result.toString();
      return parseFloat(result.toFixed(2)).toString();
    }
    return 'ERR';
  } catch {
    return 'ERR';
  }
}

// ==================== NEW: REORDER COLUMNS ====================
export async function reorderColumns(registerId: number, columnIds: number[]): Promise<Column[]> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const reordered: Column[] = [];
  columnIds.forEach((colId, idx) => {
    const col = reg.columns.find((c) => c.id === colId);
    if (col) {
      col.position = idx;
      reordered.push(col);
    }
  });
  reg.columns = reordered;
  return reordered;
}

export async function addColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }): Promise<Column> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const col: Column = {
    id: Date.now(),
    registerId,
    name: data.name,
    type: data.type,
    position: reg.columns.length,
    dropdownOptions: data.dropdownOptions,
    formula: data.formula,
  };
  reg.columns.push(col);
  return col;
}

export async function deleteColumn(registerId: number, columnId: number): Promise<void> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  reg.columns = reg.columns.filter((c) => c.id !== columnId);
}

// ==================== NEW: COLUMN RENAME ====================
export async function renameColumn(registerId: number, columnId: number, newName: string): Promise<Column> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  
  col.name = newName;
  return col;
}

// ==================== NEW: UPDATE COLUMN DROPDOWN OPTIONS ====================
export async function updateColumnDropdownOptions(registerId: number, columnId: number, options: string[]): Promise<Column> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  
  col.dropdownOptions = options;
  return col;
}

export async function duplicateColumn(registerId: number, columnId: number): Promise<Column> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const original = reg.columns.find((c) => c.id === columnId);
  if (!original) throw new Error('Column not found');
  const newCol: Column = {
    id: Date.now(), registerId, name: `${original.name} (Copy)`, type: original.type,
    position: reg.columns.length, dropdownOptions: original.dropdownOptions ? [...original.dropdownOptions] : undefined,
    formula: original.formula,
  };
  reg.columns.push(newCol);
  // Copy cell data from original column to new column
  reg.entries.forEach((entry) => {
    const val = entry.cells?.[columnId.toString()];
    if (val) entry.cells[newCol.id.toString()] = val;
  });
  return newCol;
}

export async function moveColumn(registerId: number, columnId: number, direction: 'left' | 'right'): Promise<void> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const idx = reg.columns.findIndex((c) => c.id === columnId);
  if (idx === -1) throw new Error('Column not found');
  const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= reg.columns.length) return;
  // Swap
  [reg.columns[idx], reg.columns[targetIdx]] = [reg.columns[targetIdx], reg.columns[idx]];
  // Update positions
  reg.columns.forEach((c, i) => c.position = i);
}

export async function changeColumnType(registerId: number, columnId: number, newType: string): Promise<Column> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  col.type = newType;
  if (newType !== 'dropdown') col.dropdownOptions = undefined;
  if (newType !== 'formula') col.formula = undefined;
  return col;
}

export async function clearColumnData(registerId: number, columnId: number): Promise<void> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const colIdStr = columnId.toString();
  reg.entries.forEach((entry) => {
    if (entry.cells && entry.cells[colIdStr] !== undefined) {
      delete entry.cells[colIdStr];
    }
  });
}

export async function insertColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }, position: number): Promise<Column> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const col: Column = {
    id: Date.now(), registerId, name: data.name, type: data.type,
    position, dropdownOptions: data.dropdownOptions, formula: data.formula,
  };
  reg.columns.splice(position, 0, col);
  reg.columns.forEach((c, i) => c.position = i);
  return col;
}

export async function freezeColumn(registerId: number, columnId: number, frozen: boolean): Promise<Column> {
  await delay(100);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  (col as any).frozen = frozen;
  return col;
}

export async function hideColumn(registerId: number, columnId: number, hidden: boolean): Promise<Column> {
  await delay(100);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  const col = reg.columns.find((c) => c.id === columnId);
  if (!col) throw new Error('Column not found');
  (col as any).hidden = hidden;
  return col;
}

export async function addEntry(registerId: number, cells: Record<string, string> = {}, pageIndex: number = 0): Promise<Entry> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const pageEntries = reg.entries.filter((e) => (e.pageIndex || 0) === pageIndex);
  const entry: Entry = {
    id: Date.now(),
    registerId,
    rowNumber: pageEntries.length + 1,
    cells,
    createdAt: new Date().toISOString(),
    pageIndex,
  };
  reg.entries.push(entry);
  reg.entryCount = reg.entries.length;
  reg.updatedAt = new Date().toISOString();
  return entry;
}

export async function updateEntry(
  registerId: number,
  entryId: number,
  cells: Record<string, string>
): Promise<Entry> {
  await delay(100);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const entry = reg.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('Entry not found');
  
  entry.cells = { ...entry.cells, ...cells };
  reg.updatedAt = new Date().toISOString();
  return entry;
}

export async function deleteEntry(registerId: number, entryId: number): Promise<void> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  reg.entries = reg.entries.filter((e) => e.id !== entryId);
  reg.entryCount = reg.entries.length;
}

// ==================== NEW: DUPLICATE ROW ====================
export async function duplicateEntry(registerId: number, entryId: number): Promise<Entry> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const original = reg.entries.find((e) => e.id === entryId);
  if (!original) throw new Error('Entry not found');
  
  const duplicate: Entry = {
    id: Date.now(),
    registerId,
    rowNumber: reg.entries.length + 1,
    cells: { ...original.cells },
    createdAt: new Date().toISOString(),
    pageIndex: original.pageIndex,
  };
  reg.entries.push(duplicate);
  reg.entryCount = reg.entries.length;
  return duplicate;
}

// ==================== NEW: BULK DELETE ====================
export async function bulkDeleteEntries(registerId: number, entryIds: number[]): Promise<void> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  reg.entries = reg.entries.filter((e) => !entryIds.includes(e.id));
  reg.entryCount = reg.entries.length;
}

// ==================== NEW: PAGES ====================
export async function addPage(registerId: number, pageName?: string): Promise<Page> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  if (!reg.pages) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  
  const newPage: Page = {
    id: Date.now(),
    name: pageName || `Page ${reg.pages.length + 1}`,
    index: reg.pages.length,
  };
  reg.pages.push(newPage);
  return newPage;
}

export async function renamePage(registerId: number, pageId: number, newName: string): Promise<Page> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const page = reg.pages?.find((p) => p.id === pageId);
  if (!page) throw new Error('Page not found');
  
  page.name = newName;
  return page;
}

export async function deletePage(registerId: number, pageId: number): Promise<void> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  if (!reg.pages || reg.pages.length <= 1) {
    throw new Error('Cannot delete the only page');
  }
  
  reg.pages = reg.pages.filter((p) => p.id !== pageId);
  // Also delete entries on that page
  const pageIndex = reg.pages.findIndex((p) => p.id === pageId);
  reg.entries = reg.entries.filter((e) => (e.pageIndex || 0) !== pageIndex);
  reg.entryCount = reg.entries.length;
}

// ==================== NEW: SHARE ====================
export async function generateShareLink(registerId: number): Promise<string> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  const link = `https://rekord.app/share/${registerId}/${Date.now().toString(36)}`;
  reg.shareLink = link;
  return link;
}

export async function addSharedUser(registerId: number, phone: string, permission: 'view' | 'edit'): Promise<SharedUser> {
  await delay(300);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  if (!reg.sharedWith) reg.sharedWith = [];
  
  const user: SharedUser = {
    id: Date.now(),
    name: `User ${phone.slice(-4)}`,
    phone,
    permission,
    addedAt: new Date().toISOString(),
  };
  reg.sharedWith.push(user);
  return user;
}

export async function removeSharedUser(registerId: number, userId: number): Promise<void> {
  await delay(200);
  const reg = DB.registers.find((r) => r.id === registerId);
  if (!reg) throw new Error('Register not found');
  
  if (reg.sharedWith) {
    reg.sharedWith = reg.sharedWith.filter((u) => u.id !== userId);
  }
}

// ==================== NEW: CSV EXPORT ====================
export function generateCSV(register: RegisterDetail, pageIndex: number = 0): string {
  const cols = register.columns;
  const entries = register.entries.filter((e) => (e.pageIndex || 0) === pageIndex);
  
  // Header row
  const headers = ['S.No.', ...cols.map((c) => c.name)];
  const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
  
  // Data rows
  const dataRows = entries.map((entry, idx) => {
    const row = [
      (idx + 1).toString(),
      ...cols.map((col) => {
        const val = entry.cells?.[col.id.toString()] || '';
        return `"${val.replace(/"/g, '""')}"`;
      }),
    ];
    return row.join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

// ==================== NEW: COLUMN STATS ====================
export interface ColumnStats {
  sum: number;
  average: number;
  count: number;
  min: number;
  max: number;
  filled: number;
}

export function calculateColumnStats(entries: Entry[], columnId: string): ColumnStats {
  const values = entries
    .map((e) => e.cells?.[columnId])
    .filter((v) => v !== undefined && v !== null && v !== '');
  
  const numbers = values.map((v) => parseFloat(v!)).filter((n) => !isNaN(n));
  
  return {
    sum: numbers.reduce((a, b) => a + b, 0),
    average: numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0,
    count: values.length,
    min: numbers.length > 0 ? Math.min(...numbers) : 0,
    max: numbers.length > 0 ? Math.max(...numbers) : 0,
    filled: values.length,
  };
}

// ==================== DASHBOARD ====================
export interface DashboardSummary {
  totalRegisters: number;
  totalEntries: number;
  recentRegisters: RegisterSummary[];
  categoryBreakdown: Array<{ category: string; count: number }>;
}

export async function getDashboardSummary(businessId: number): Promise<DashboardSummary> {
  await delay(300);
  const regs = DB.registers.filter((r) => r.businessId === businessId);
  const totalEntries = regs.reduce((sum, r) => sum + r.entries.length, 0);
  
  return {
    totalRegisters: regs.length,
    totalEntries,
    recentRegisters: regs.slice(0, 5),
    categoryBreakdown: [],
  };
}
