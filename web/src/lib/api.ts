// Firestore-backed API client for RecordBook Web
import { db } from './firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { TEMPLATES, type Template, type TemplateColumn } from './templates';
// Local filesystem completely unmounted from regular API.

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
  const bus: Business = { id: generateId(), name, ownerId: 1, createdAt: new Date().toISOString() };
  await setDoc(doc(db, 'businesses', bus.id.toString()), bus);
  return bus;
}

// ==================== FOLDERS ====================
export interface Folder {
  id: number;
  businessId: number;
  name: string;
  createdAt: string;
}

const foldersCol = () => collection(db, 'folders');
const folderDoc = (id: number) => doc(db, 'folders', id.toString());

export async function listFolders(businessId: number): Promise<Folder[]> {
  const q = query(foldersCol(), where('businessId', '==', businessId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Folder);
}

export async function createFolder(businessId: number, name: string): Promise<Folder> {
  const folder: Folder = { id: generateId(), businessId, name, createdAt: new Date().toISOString() };
  await setDoc(folderDoc(folder.id), folder);
  return folder;
}

export async function deleteFolder(folderId: number): Promise<void> {
  await deleteDoc(folderDoc(folderId));
  const q = query(registersCol(), where('folderId', '==', folderId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const reg = await getRegDoc(Number(d.id));
    delete reg.folderId;
    await saveRegDocImmediate(reg);
  }
}

export async function renameFolder(folderId: number, newName: string): Promise<Folder> {
  const snap = await getDoc(folderDoc(folderId));
  if (!snap.exists()) throw new Error('Folder not found');
  const folder = snap.data() as Folder;
  folder.name = newName;
  await setDoc(folderDoc(folderId), folder);
  return folder;
}


// ==================== REGISTERS ====================
export interface RegisterSummary {
  id: number; businessId: number; folderId?: number; name: string; icon: string; iconColor?: string;
  category: string; template: string; createdAt: string; updatedAt: string; entryCount: number;
  lastActivity?: string;
}

export interface Column {
  id: number; registerId: number; name: string; type: string; position: number;
  dropdownOptions?: string[]; formula?: string; width?: number;
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

// ── Firestore helpers ─────────────────────────────────────────────────────────
const registersCol = () => collection(db, 'registers');
const regDoc = (id: number) => doc(db, 'registers', id.toString());

// In-memory cache so reads never hit Firestore after the first load
const firestoreRegisterCache = new Map<number, RegisterDetail>();
// Mutation queue: ensures operations on the same register run serially to prevent race conditions
const registerMutationQueues = new Map<string | number, Promise<any>>();
// Tracks how many mutations are currently pending/running globally
let pendingMutationsCount = 0;
const mutationListeners = new Set<(count: number) => void>();
let lastGeneratedId = 0;

function generateId(): number {
  const now = Date.now();
  lastGeneratedId = now <= lastGeneratedId ? lastGeneratedId + 1 : now;
  return lastGeneratedId;
}

export function subscribeToMutationStatus(callback: (count: number) => void) {
  mutationListeners.add(callback);
  callback(pendingMutationsCount);
  return () => mutationListeners.delete(callback);
}

function updateMutationCount(delta: number) {
  pendingMutationsCount += delta;
  mutationListeners.forEach(cb => cb(pendingMutationsCount));
}

async function runQueuedMutation<T>(registerId: number | string, op: () => Promise<T>): Promise<T> {
  const key = registerId.toString();
  const currentQueue = registerMutationQueues.get(key) || Promise.resolve();
  updateMutationCount(1);
  const next = currentQueue.then(op).finally(() => {
    updateMutationCount(-1);
  }).catch((err) => {
    console.error(`Mutation failed for register ${key}:`, err);
    throw err;
  });
  registerMutationQueues.set(key, next);
  return next;
}

/** Helper to populate auto-increment values for existing rows */
function populateAutoIncrement(reg: RegisterDetail, columnId: number) {
  const colIdStr = columnId.toString();
  let maxVal = 0;
  reg.entries.forEach(e => {
    const v = parseInt(e.cells?.[colIdStr] || '0', 10);
    if (!isNaN(v) && v > maxVal) maxVal = v;
  });
  reg.entries.forEach(e => {
    if (!e.cells) e.cells = {};
    if (!e.cells[colIdStr] || e.cells[colIdStr].trim() === '') {
      maxVal++;
      e.cells[colIdStr] = maxVal.toString();
    }
  });
}

async function getRegDoc(registerId: number): Promise<RegisterDetail> {
  // Local filesystem checks removed.
  // Return a shallow-safe clone from cache — avoids a Firestore round-trip on every mutation
  // structuredClone is ~3× faster than JSON.parse(JSON.stringify) for plain-object graphs
  if (firestoreRegisterCache.has(registerId)) {
    return structuredClone(firestoreRegisterCache.get(registerId)!);
  }
  const snap = await getDoc(regDoc(registerId));
  if (!snap.exists()) throw new Error('Register not found');
  const data = snap.data() as RegisterDetail;
  
  // Ensure basic arrays exist so mutations don't crash
  if (!data.columns) data.columns = [];
  if (!data.entries) data.entries = [];
  if (!data.pages) data.pages = [];
  if (!data.sharedWith) data.sharedWith = [];
  
  // Ensure every entry has a cells object
  data.entries.forEach(e => { if (!e.cells) e.cells = {}; });

  // Store the raw Firestore data in cache; return a clone so mutations stay isolated
  firestoreRegisterCache.set(registerId, data);
  return structuredClone(data);
}

/**
 * Immediately persist a register to Firestore — bypasses debounce.
 * Use for structural changes (add/delete/rename column, add/delete entries)
 * that MUST survive a page refresh.
 */
async function saveRegDocImmediate(reg: RegisterDetail): Promise<void> {
  // Firestore does not allow 'undefined' values. JSON conversion is a reliable
  // way to strip undefined keys before persistence.
  const cleaned = JSON.parse(JSON.stringify(reg));
  
  // Update cache immediately so subsequent mutations see this state
  firestoreRegisterCache.set(reg.id, reg);
  
  // Do NOT swallow errors here — we want mutations to fail (and roll back optimistically) 
  // if Firestore rejects the write (e.g. offline, permissions, or invalid data).
  await setDoc(regDoc(reg.id), cleaned);
}

async function flushPendingWrite(registerId: number): Promise<void> {
  // Now redundant with serial queueing, but kept for interface compatibility
  const queue = registerMutationQueues.get(registerId);
  if (queue) await queue;
}

/**
 * Flush all pending debounced writes across all registers to Firestore.
 */
export async function flushAllPendingWrites(): Promise<void> {
  await Promise.all(Array.from(registerMutationQueues.values()));
}

// Export so the query can bust the cache when needed (e.g., switching between registers)
export function bustRegisterCache(registerId: number): void {
  // Flush any pending write first so it's not lost
  flushPendingWrite(registerId);
  firestoreRegisterCache.delete(registerId);
}


// ── Public API ───────────────────────────────────────────────────────────────

export async function listRegisters(businessId: number): Promise<RegisterSummary[]> {
  const q = query(registersCol(), where('businessId', '==', businessId));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    // Use stored scalar fields only — never iterate r.entries[] here so we don't
    // deserialise thousands of cells just to count them (Fix #4)
    const r = d.data() as RegisterDetail;
    return {
      id: r.id, businessId: r.businessId, folderId: r.folderId, name: r.name, icon: r.icon, iconColor: r.iconColor,
      category: r.category, template: r.template, createdAt: r.createdAt, updatedAt: r.updatedAt,
      entryCount: r.entryCount ?? (r.entries?.length ?? 0),
      lastActivity: r.lastActivity ?? '',
    };
  });
}

export async function getRegister(registerId: number): Promise<RegisterDetail> {
  const reg = await getRegDoc(registerId);
  if (!reg.pages || reg.pages.length === 0) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  if (!reg.entries) reg.entries = [];
  if (!reg.columns) reg.columns = [];

  // MIGRATION: Fix duplicate IDs caused by precision loss in older Excel imports
  let hasDuplicates = false;
  const seenIds = new Set<number>();
  reg.entries.forEach((e, idx) => {
    if (seenIds.has(e.id)) {
      hasDuplicates = true;
      e.id = reg.id + 10000 + idx; // Reassign a unique ID based on safe offset logic
    }
    seenIds.add(e.id);
  });

  if (hasDuplicates) {
    // Save the corrected register back to Firestore immediately so it's permanently fixed
    await saveRegDocImmediate(reg);
  }

  return reg;
}

export async function createRegister(data: {
  businessId: number; folderId?: number; name: string; icon?: string; iconColor?: string;
  category?: string; template?: string;
  columns?: Array<{ name: string; type: string; dropdownOptions?: string[]; formula?: string }>;
}): Promise<RegisterSummary> {
  const newId = generateId();
  const newReg: RegisterDetail = {
    id: newId, businessId: data.businessId, folderId: data.folderId, name: data.name,
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
  // Store in memory-cache immediately so in-memory reads see it right away
  firestoreRegisterCache.set(newId, newReg);
  // Write directly to Firestore NOW (no debounce) — new docs must be persisted before
  // listRegisters queries Firestore, otherwise the new register won't appear in the list.
  // We use JSON.parse(JSON.stringify) to strip any undefined values (like optional iconColor or formula)
  // which Firebase v9+ natively rejects unless ignoreUndefinedProperties is globally configured.
  await setDoc(regDoc(newId), JSON.parse(JSON.stringify(newReg)));
  return newReg;
}

export async function deleteRegister(registerId: number): Promise<void> {
  await deleteDoc(regDoc(registerId));
}

export async function renameRegister(registerId: number, newName: string): Promise<RegisterSummary> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.name = newName;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function duplicateRegister(registerId: number): Promise<RegisterSummary> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const newId = generateId();
    const duplicated: RegisterDetail = {
      ...JSON.parse(JSON.stringify(reg)), id: newId, name: `${reg.name} (Copy)`,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: reg.entries.length,
    };
    duplicated.columns = duplicated.columns.map((c: Column, i: number) => ({ ...c, id: newId + i + 1, registerId: newId }));
    duplicated.entries = duplicated.entries.map((e: Entry, i: number) => ({ ...e, id: newId + 1000 + i, registerId: newId }));
    duplicated.pages = duplicated.pages.map((p: Page, i: number) => ({ ...p, id: newId + 2000 + i }));
    await saveRegDocImmediate(duplicated);
    return duplicated;
  });
}

export async function moveRegisterToFolder(registerId: number, folderId: number | null): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (folderId !== null) {
      reg.folderId = folderId;
    } else {
      delete reg.folderId;
    }
    await saveRegDocImmediate(reg);
  });
}

// ── Excel Import: Column-type alias map ──────────────────────────────────────
// Maps common Excel header patterns → { type, dropdownOptions? }
// Keys are lowercase. Matching uses both exact and substring checks.
interface ColumnHint { type: string; dropdownOptions?: string[] }

const COLUMN_ALIASES: Record<string, ColumnHint> = {
  // ── Date fields ──
  'dob':             { type: 'date' },
  'date of birth':   { type: 'date' },
  'd.o.b':           { type: 'date' },
  'date':            { type: 'date' },
  'admission date':  { type: 'date' },
  'joining date':    { type: 'date' },
  'join date':       { type: 'date' },
  'paid date':       { type: 'date' },
  'due date':        { type: 'date' },
  'start date':      { type: 'date' },
  'end date':        { type: 'date' },
  'expiry':          { type: 'date' },
  'expiry date':     { type: 'date' },

  // ── Grade / Standard / Class ──
  'grade':           { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'class':           { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'standard':        { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'std':             { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'section':         { type: 'dropdown', dropdownOptions: ['A', 'B', 'C', 'D', 'E'] },

  // ── Gender ──
  'gender':          { type: 'dropdown', dropdownOptions: ['Male', 'Female', 'Other'] },
  'sex':             { type: 'dropdown', dropdownOptions: ['Male', 'Female', 'Other'] },

  // ── Community / Caste ──
  'community':       { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },
  'com':             { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },
  'caste':           { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },
  'category':        { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },

  // ── Status ──
  'status':          { type: 'dropdown', dropdownOptions: ['Active', 'Inactive', 'Pending'] },
  'old/new':         { type: 'dropdown', dropdownOptions: ['OLD', 'NEW'] },
  'old / new':       { type: 'dropdown', dropdownOptions: ['OLD', 'NEW'] },
  'sib stu':         { type: 'checkbox' },
  'sibling':         { type: 'checkbox' },

  // ── Religion ──
  'religion':        { type: 'dropdown', dropdownOptions: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'] },

  // ── Blood Group ──
  'blood group':     { type: 'dropdown', dropdownOptions: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  'blood grp':       { type: 'dropdown', dropdownOptions: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },

  // ── Payment mode ──
  'payment mode':    { type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit', 'Cheque'] },
  'mode of payment': { type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit', 'Cheque'] },

  // ── Numeric fields ──
  's.no':            { type: 'number' },
  's.no.':           { type: 'number' },
  'sno':             { type: 'number' },
  'sl no':           { type: 'number' },
  'sl.no':           { type: 'number' },
  'sl.no.':          { type: 'number' },
  'serial':          { type: 'number' },
  'serial no':       { type: 'number' },
  'roll no':         { type: 'number' },
  'roll number':     { type: 'number' },
  'age':             { type: 'number' },
  'amount':          { type: 'number' },
  'total':           { type: 'number' },
  'balance':         { type: 'number' },
  'fees':            { type: 'number' },
  'fee':             { type: 'number' },
  'price':           { type: 'number' },
  'qty':             { type: 'number' },
  'quantity':        { type: 'number' },
};

// Substring patterns checked when the exact alias lookup misses
const COLUMN_SUBSTRING_HINTS: { pattern: string; hint: ColumnHint }[] = [
  { pattern: 'date',      hint: { type: 'date' } },
  { pattern: 'phone',     hint: { type: 'text' } },
  { pattern: 'mobile',    hint: { type: 'text' } },
  { pattern: 'contact',   hint: { type: 'text' } },
  { pattern: 'number',    hint: { type: 'text' } },  // fallback — could be roll no, phone no, etc.
  { pattern: 'address',   hint: { type: 'text' } },
  { pattern: 'email',     hint: { type: 'text' } },
  { pattern: 'remark',    hint: { type: 'text' } },
  { pattern: 'note',      hint: { type: 'text' } },
];

/**
 * Convert an Excel serial date number to a DD-MM-YYYY string.
 * Excel serial: days since 1900-01-01 (with the Lotus 1-2-3 leap year bug).
 */
function excelSerialToDateStr(serial: number): string {
  // Excel epoch: Jan 0 1900 (i.e. Dec 31 1899). Also has a phantom Feb 29 1900.
  const utcDays = serial - 25569; // offset from Unix epoch (Jan 1 1970)
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Check if a value looks like an Excel serial date (number between ~1 and ~60000). */
function looksLikeExcelSerial(val: unknown): boolean {
  if (typeof val !== 'number') return false;
  return val > 1 && val < 200000 && Number.isInteger(val);
}

/**
 * Resolve a column's type by:
 *  1. Exact template column match (case-insensitive)
 *  2. Exact alias map lookup
 *  3. Substring alias patterns
 *  4. Data-driven detection (sample actual values)
 */
function resolveColumnType(
  header: string,
  bestTemplate: Template | null,
  sampleValues: (string | number | boolean | null)[],
): { type: string; dropdownOptions?: string[]; formula?: string } {
  const lowerH = header.toLowerCase().trim();

  // 1. Exact case-insensitive template column match
  if (bestTemplate) {
    const tplCol = bestTemplate.columns.find(
      (c: TemplateColumn) => c.name.toLowerCase().trim() === lowerH,
    );
    if (tplCol) {
      return { type: tplCol.type, dropdownOptions: tplCol.dropdownOptions, formula: tplCol.formula };
    }
  }

  // 2. Exact alias map lookup
  if (COLUMN_ALIASES[lowerH]) {
    return { ...COLUMN_ALIASES[lowerH] };
  }

  // 3. Substring alias patterns
  for (const { pattern, hint } of COLUMN_SUBSTRING_HINTS) {
    if (lowerH.includes(pattern)) {
      return { ...hint };
    }
  }

  // Also check alias keys as substrings (e.g., header "STUDENT GRADE" contains "grade")
  for (const [aliasKey, aliasHint] of Object.entries(COLUMN_ALIASES)) {
    if (lowerH.includes(aliasKey) || aliasKey.includes(lowerH)) {
      return { ...aliasHint };
    }
  }

  // 4. Data-driven detection: sample non-empty values
  const nonEmpty = sampleValues
    .filter((v) => v !== null && v !== undefined && v !== '')
    .slice(0, 20); // sample up to 20 rows

  if (nonEmpty.length > 0) {
    // Check if most values look like dates (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, etc.)
    const datePattern = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
    const dateCount = nonEmpty.filter((v) => datePattern.test(String(v).trim())).length;
    if (dateCount >= nonEmpty.length * 0.6) {
      return { type: 'date' };
    }

    // Check if values are Excel serial dates (all numbers in a plausible date range)
    const serialDateCount = nonEmpty.filter((v) => looksLikeExcelSerial(v)).length;
    if (serialDateCount >= nonEmpty.length * 0.6) {
      return { type: 'date' };
    }

    // Check if all values are numbers
    const numCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
    if (numCount >= nonEmpty.length * 0.8) {
      return { type: 'number' };
    }
  }

  return { type: 'text' };
}

export const importExcelData = async (businessId: number, name: string, data: Record<string, string | number | boolean | null>[], folderId?: number): Promise<RegisterSummary> => {
  if (!data || data.length === 0) throw new Error("No data found in the spreadsheet");

  const headers = Object.keys(data[0]);

  // ── Find best-matching template (case-insensitive + alias-aware) ──
  let bestTemplate: Template | null = null;
  let maxMatches = 0;

  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (const cat in TEMPLATES) {
    for (const tpl of TEMPLATES[cat]) {
      if (!tpl.columns.length) continue; // skip "Blank Register"
      let matchCount = 0;
      for (const tc of tpl.columns) {
        const tcLower = tc.name.toLowerCase().trim();
        // Exact match or header-contains-template or template-contains-header
        if (normalizedHeaders.some(nh =>
          nh === tcLower ||
          nh.includes(tcLower) ||
          tcLower.includes(nh)
        )) {
          matchCount++;
        }
      }
      if (matchCount > maxMatches && matchCount >= 2) {
        maxMatches = matchCount;
        bestTemplate = tpl;
      }
    }
  }

  // ── Build column definitions ──
  const columns = headers.map((h, i) => {
    // Collect sample values for this column from the data
    const sampleValues = data.slice(0, 30).map(row => row[h]);
    const resolved = resolveColumnType(h, bestTemplate, sampleValues);

    return {
      name: h || `Column ${i + 1}`,
      type: resolved.type,
      dropdownOptions: resolved.dropdownOptions,
      formula: resolved.formula,
    };
  });

  const createdReg = await createRegister({ businessId, folderId, name, columns }) as RegisterDetail;

  // Clear the 3 default empty rows that createRegister adds, then populate from Excel data.
  // Work with the cached copy directly — no redundant getRegDoc round-trip needed.
  createdReg.entries = [];

  data.forEach((row, rowIndex) => {
    const cells: Record<string, string> = {};
    headers.forEach((h, colIndex) => {
      let val = row[h];
      if (val !== undefined && val !== null && val !== '') {
        // Convert Excel serial dates to human-readable DD-MM-YYYY
        const colType = createdReg.columns[colIndex]?.type;
        if (colType === 'date' && typeof val === 'number' && looksLikeExcelSerial(val)) {
          val = excelSerialToDateStr(val);
        }
        cells[createdReg.columns[colIndex].id.toString()] = String(val);
      }
    });

    // Stable ID: use offset to avoid Number.MAX_SAFE_INTEGER precision loss.
    createdReg.entries.push({
      id: createdReg.id + 10000 + rowIndex,
      registerId: createdReg.id,
      rowNumber: rowIndex + 1,
      cells,
      createdAt: new Date().toISOString(),
      pageIndex: 0,
    });
  });

  createdReg.entryCount = createdReg.entries.length;
  await saveRegDocImmediate(createdReg);
  return createdReg;
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

const _sortedColumnsCache = new WeakMap<any[], any[]>();
const _regexCache = new Map<string, RegExp>();
function getColumnRegex(name: string): RegExp {
  const cached = _regexCache.get(name);
  if (cached) return cached;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('\\{' + escaped + '\\}', 'gi');
  _regexCache.set(name, regex);
  return regex;
}

export function evaluateFormula(formula: string, entry: Entry, columns: Column[]): string {
  if (!formula || formula.trim() === '') return '';
  try {
    let sorted = _sortedColumnsCache.get(columns);
    if (!sorted) {
      sorted = [...columns].sort((a, b) => b.name.length - a.name.length);
      _sortedColumnsCache.set(columns, sorted);
    }
    
    let expression = formula;
    // Check if formula contains any curly braces before doing expensive replacements
    if (!expression.includes('{')) {
      const result = parseAndEval(expression);
      return (typeof result === 'number' && isFinite(result)) ? result.toString() : '';
    }

    for (const col of sorted) {
      const colPlaceholder = `{${col.name}}`;
      if (!expression.toLowerCase().includes(colPlaceholder.toLowerCase())) continue;

      const regex = getColumnRegex(col.name);
      const rawVal = entry.cells?.[col.id.toString()] ?? '';
      let numStr: string;
      
      if (col.type === 'formula' && col.formula) {
        const nested = evaluateFormula(col.formula, entry, columns);
        numStr = (nested === '') ? '0' : nested;
      } else {
        const parsed = parseFloat(rawVal.replace(/[₹$,]/g, ''));
        numStr = isNaN(parsed) ? '0' : parsed.toString();
      }
      expression = expression.replace(regex, numStr);
    }
    
    expression = expression.replace(/\{[^}]*\}/g, '0');
    expression = expression.trim();
    if (expression === '') return '';
    
    const result = parseAndEval(expression);
    if (typeof result === 'number' && isFinite(result)) {
      if (Number.isInteger(result)) return result.toString();
      const fixed = parseFloat(result.toFixed(2));
      return fixed.toString();
    }
    return '';
  } catch {
    return '';
  }
}


// ─── Column Operations ──────────────────────────────────────────────────────

export async function addColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const colId = generateId();
    const col: Column = {
      id: colId, registerId, name: data.name, type: data.type,
      position: reg.columns.length, dropdownOptions: data.dropdownOptions, formula: data.formula,
    };
    reg.columns.push(col);
    if (data.type === 'auto_increment') {
      populateAutoIncrement(reg, colId);
    }
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function deleteColumn(registerId: number, columnId: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.columns = reg.columns.filter((c) => c.id.toString() !== columnId.toString());
    reg.columns.forEach((c, i) => c.position = i);
    // Cleanup entry data
    reg.entries.forEach((e) => { if (e.cells) delete e.cells[columnId.toString()]; });
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function renameColumn(registerId: number, columnId: number, newName: string): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    col.name = newName;
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function updateColumnDropdownOptions(registerId: number, columnId: number, options: string[]): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    col.dropdownOptions = options;
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function duplicateColumn(registerId: number, columnId: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const original = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!original) throw new Error('Column not found');
    const newColId = generateId();
    const newCol: Column = {
      ...original,
      id: newColId,
      name: `${original.name} (Copy)`,
      position: reg.columns.length,
    };
    reg.columns.push(newCol);
    reg.entries.forEach((entry) => {
      const val = entry.cells?.[columnId.toString()];
      if (val !== undefined) {
        if (!entry.cells) entry.cells = {};
        entry.cells[newColId.toString()] = val;
      }
    });
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function moveColumn(registerId: number, columnId: number, direction: 'left' | 'right'): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const idx = reg.columns.findIndex((c) => c.id.toString() === columnId.toString());
    if (idx === -1) throw new Error('Column not found');
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < reg.columns.length) {
      [reg.columns[idx], reg.columns[targetIdx]] = [reg.columns[targetIdx], reg.columns[idx]];
      reg.columns.forEach((c, i) => c.position = i);
      await saveRegDocImmediate(reg);
    }
    return reg;
  });
}

export async function updateColumnWidth(registerId: number, columnId: number, width: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (col) {
      col.width = width;
      await saveRegDocImmediate(reg);
    }
    return reg;
  });
}

export async function reorderColumn(registerId: number, columnId: number, targetIndex: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const idx = reg.columns.findIndex((c) => c.id.toString() === columnId.toString());
    if (idx === -1) throw new Error('Column not found');
    
    // Remove the column from its original position
    const [col] = reg.columns.splice(idx, 1);
    
    // Insert it at the target position
    // If targetIndex is out of bounds, splice handles it decently, but let's clamp it.
    const clampedTarget = Math.max(0, Math.min(targetIndex, reg.columns.length));
    reg.columns.splice(clampedTarget, 0, col);
    
    // Update the position properties
    reg.columns.forEach((c, i) => c.position = i);
    
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function changeColumnType(
  registerId: number, 
  columnId: number, 
  newType: string, 
  options?: { formula?: string; dropdownOptions?: string[] }
): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    
    const oldType = col.type;
    col.type = newType;
    
    if (newType === 'formula') {
      col.formula = options?.formula;
    } else {
      col.formula = undefined;
    }

    if (newType === 'dropdown') {
      col.dropdownOptions = options?.dropdownOptions;
    } else {
      col.dropdownOptions = undefined;
    }

    // Auto-populate existing rows if switching TO auto_increment
    if (newType === 'auto_increment' && oldType !== 'auto_increment') {
      populateAutoIncrement(reg, columnId);
    }

    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function clearColumnData(registerId: number, columnId: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const colIdStr = columnId.toString();
    reg.entries.forEach((entry) => {
      if (entry.cells) delete entry.cells[colIdStr];
    });
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function insertColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }, position: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const colId = generateId();
    const col: Column = {
      id: colId, registerId, name: data.name, type: data.type,
      position, dropdownOptions: data.dropdownOptions, formula: data.formula,
    };
    reg.columns.splice(position, 0, col);
    reg.columns.forEach((c, i) => c.position = i);
    if (data.type === 'auto_increment') {
      populateAutoIncrement(reg, colId);
    }
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function freezeColumn(registerId: number, columnId: number, frozen: boolean): Promise<Column> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id === columnId);
    if (!col) return {} as any;
    (col as any).frozen = frozen;
    await saveRegDocImmediate(reg);
    return col;
  });
}

export async function hideColumn(registerId: number, columnId: number, hidden: boolean): Promise<Column> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id === columnId);
    if (!col) return {} as any;
    (col as any).hidden = hidden;
    await saveRegDocImmediate(reg);
    return col;
  });
}

// ─── Entry Operations ────────────────────────────────────────────────────────

export async function addEntry(registerId: number, cells: Record<string, string> = {}, pageIndex: number = 0): Promise<Entry> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const pageEntries = reg.entries.filter((e) => (e.pageIndex || 0) === pageIndex);

    // Auto-populate auto_increment columns
    const autoIncrCols = reg.columns.filter(c => c.type === 'auto_increment');
    for (const col of autoIncrCols) {
      const colIdStr = col.id.toString();
      if (!cells[colIdStr]) {
        let maxVal = 0;
        for (const e of pageEntries) {
          const v = parseInt(e.cells?.[colIdStr] || '0', 10);
          if (!isNaN(v) && v > maxVal) maxVal = v;
        }
        cells[colIdStr] = (maxVal + 1).toString();
      }
    }

    const entry: Entry = {
      id: generateId(), registerId, rowNumber: pageEntries.length + 1,
      cells, createdAt: new Date().toISOString(), pageIndex,
    };
    reg.entries.push(entry);
    reg.entryCount = reg.entries.length;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    return entry;
  });
}

export async function updateEntry(registerId: number, entryId: number, cells: Record<string, string>): Promise<Entry> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const entry = reg.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error('Entry not found');

    // Security: Filter out any attempts to manually update auto_increment columns
    const autoColIds = new Set(reg.columns.filter(c => c.type === 'auto_increment').map(c => c.id.toString()));
    const safeCells = Object.fromEntries(
      Object.entries(cells).filter(([colId]) => !autoColIds.has(colId))
    );

    entry.cells = { ...entry.cells, ...safeCells };
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    return entry;
  });
}

export async function updateEntriesOrder(registerId: number, sortedEntries: Entry[]): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    // Overwrite the entire entries array with the new sorted array
    reg.entries = sortedEntries;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
  });
}

export async function deleteEntry(registerId: number, entryId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.entries = reg.entries.filter((e) => e.id !== entryId);
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
  });
}

export async function duplicateEntry(registerId: number, entryId: number): Promise<Entry> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const original = reg.entries.find((e) => e.id === entryId);
    if (!original) throw new Error('Entry not found');
    const duplicate: Entry = {
      id: generateId(), registerId, rowNumber: reg.entries.length + 1,
      cells: { ...original.cells }, createdAt: new Date().toISOString(), pageIndex: original.pageIndex,
    };
    reg.entries.push(duplicate);
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
    return duplicate;
  });
}

export async function bulkDeleteEntries(registerId: number, entryIds: number[]): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.entries = reg.entries.filter((e) => !entryIds.includes(e.id));
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
  });
}

// ─── Page Operations ─────────────────────────────────────────────────────────

export async function addPage(registerId: number, pageName?: string): Promise<Page> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.pages) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
    const newPage: Page = { id: generateId(), name: pageName || `Page ${reg.pages.length + 1}`, index: reg.pages.length };
    reg.pages.push(newPage);
    await saveRegDocImmediate(reg);
    return newPage;
  });
}

export async function renamePage(registerId: number, pageId: number, newName: string): Promise<Page> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const page = reg.pages?.find((p) => p.id === pageId);
    if (!page) throw new Error('Page not found');
    page.name = newName;
    await saveRegDocImmediate(reg);
    return page;
  });
}

export async function deletePage(registerId: number, pageId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.pages || reg.pages.length <= 1) throw new Error('Cannot delete the only page');
    const targetPage = reg.pages.find((p) => p.id === pageId);
    if (!targetPage) throw new Error('Page not found');
    const targetPageIndex = targetPage.index;
    reg.pages = reg.pages.filter((p) => p.id !== pageId);
    reg.entries = reg.entries.filter((e) => (e.pageIndex || 0) !== targetPageIndex);
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
  });
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

export async function generateShareLink(registerId: number): Promise<string> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const link = `https://rekord.app/share/${registerId}/${Date.now().toString(36)}`;
    reg.shareLink = link;
    await saveRegDocImmediate(reg);
    return link;
  });
}

export async function addSharedUser(registerId: number, phone: string, permission: 'view' | 'edit'): Promise<SharedUser> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.sharedWith) reg.sharedWith = [];
    const user: SharedUser = {
      id: generateId(), name: `User ${phone.slice(-4)}`, phone, permission, addedAt: new Date().toISOString(),
    };
    reg.sharedWith.push(user);
    await saveRegDocImmediate(reg);
    return user;
  });
}

export async function removeSharedUser(registerId: number, userId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (reg.sharedWith) reg.sharedWith = reg.sharedWith.filter((u) => u.id !== userId);
    await saveRegDocImmediate(reg);
  });
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

export interface ColumnStats { sum: number; average: number; count: number; min: number; max: number; filled: number; empty: number; }

export function calculateColumnStats(entries: Entry[], columnId: string): ColumnStats {
  const values = entries.map((e) => e.cells?.[columnId]).filter((v) => v !== undefined && v !== null && v !== '');
  const numbers = values.map((v) => parseFloat(v!)).filter((n) => !isNaN(n));
  return {
    sum: numbers.reduce((a, b) => a + b, 0),
    average: numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0,
    count: values.length, min: numbers.length > 0 ? Math.min(...numbers) : 0,
    max: numbers.length > 0 ? Math.max(...numbers) : 0, filled: values.length,
    empty: entries.length - values.length
  };
}
