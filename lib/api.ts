// Mock API client for RecordBook frontend testing
// Using in-memory storage to bypass need for a backend

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

// ==================== NEW: EVALUATE FORMULA ====================
export function evaluateFormula(formula: string, entry: Entry, columns: Column[]): string {
  if (!formula) return '';
  try {
    // Replace column references like {Column Name} with actual values
    let expression = formula;
    for (const col of columns) {
      const placeholder = `{${col.name}}`;
      const value = entry.cells?.[col.id.toString()] || '0';
      const numValue = parseFloat(value) || 0;
      expression = expression.replaceAll(placeholder, numValue.toString());
    }
    // Safely evaluate simple math expressions
    // Only allow numbers, operators, parentheses, and decimal points
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    if (!sanitized) return '';
    const result = Function('"use strict"; return (' + sanitized + ')')();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Number.isInteger(result) ? result.toString() : result.toFixed(2);
    }
    return '';
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
