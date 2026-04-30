import { useState, useRef, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRegister, addColumn, deleteColumn, renameColumn, updateColumnDropdownOptions,
  duplicateColumn, moveColumn, reorderColumn, changeColumnType, clearColumnData, insertColumn, updateColumnWidth,
  freezeColumn, hideColumn,
  addEntry, updateEntry, deleteEntry, duplicateEntry, bulkDeleteEntries,
  restoreEntry, bulkRestoreEntries, restoreColumn,
  addPage, renamePage, deletePage,
  evaluateFormula,
  generateShareLink, addSharedUser, removeSharedUser,
  subscribeToMutationStatus, updateEntriesOrder,
  type Entry,
} from '../lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus, ChevronDown, Calendar,
  Hash, FlaskConical, Pin, IndianRupee,
  Mail, Phone, Globe, Star, CheckSquare, Image as ImageIcon, ArrowLeft,
  Search, Filter, Eye, Trash2, FileText, Download, ListOrdered, Maximize2, AlertCircle,
  Undo2, Redo2, X
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RegisterHeader } from '../components/register/RegisterHeader';
import { SpreadsheetRow } from '../components/register/SpreadsheetRow';

import { FilterModal } from '../components/register/modals/FilterModal';
import { ShareModal } from '../components/register/modals/ShareModal';
import { ColumnModals } from '../components/register/modals/ColumnModals';
import { OtherModals } from '../components/register/modals/OtherModals';
import { RegisterContextMenus } from '../components/register/menus/RegisterContextMenus';
import { COL_TYPES } from '../lib/constants';

type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'filled' | 'empty' | 'distinct' | 'none';

// Format number with Indian currency style: ₹1,23,456.00
function formatCurrency(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val || '';
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  // Indian grouping: last 3 digits, then every 2 digits
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining) formatted = remaining + ',' + formatted;
  }
  return `${n < 0 ? '-' : ''}₹${formatted}.${decPart}`;
}

// Helper to normalize DD/MM/YYYY to YYYY-MM-DD for comparison
function parseDateString(dStr: string) {
  if (!dStr) return '';
  if (dStr.includes('/') || dStr.includes('-')) {
    const parts = dStr.split(/[/-]/);
    if (parts.length === 3) {
      // Ensure DD and MM are padded if they come in as 1 or 2 digits
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return dStr;
}

export default function RegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const registerId = Number(id);
  const queryClient = useQueryClient();
  const { data: register, isLoading, error } = useQuery({
    queryKey: ['register', registerId],
    queryFn: () => getRegister(Number(registerId)),
    enabled: !!registerId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const cachedRegister = queryClient.getQueryData(['register', registerId]) as any;

  // ── State ──
  const [search, setSearch] = useState(() => localStorage.getItem(`rb_search_${registerId}`) || '');
  const [currentPageIndex, setCurrentPageIndex] = useState(() => {
    const saved = localStorage.getItem(`rb_page_${registerId}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [localEntries, setLocalEntries] = useState<Entry[]>(cachedRegister?.entries || []);

  const [calcTypes, setCalcTypes] = useState<Record<number, CalcType>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [newColumnModal, setNewColumnModal] = useState(false);
  const [colMenuId, setColMenuId] = useState<number | null>(null);
  const [colMenuRect, setColMenuRect] = useState<DOMRect | null>(null);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);
  const [renameColModal, setRenameColModal] = useState(false);
  const [dropdownConfigModal, setDropdownConfigModal] = useState(false);
  const [changeTypeModal, setChangeTypeModal] = useState(false);
  const [insertColModal, setInsertColModal] = useState<'left' | 'right' | null>(null);
  
  // Smooth column drag-and-drop reordering
  const [draggedColumnId, setDraggedColumnId] = useState<number | null>(null);
  const [_dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const colHeaderRefs = useRef<Map<number, HTMLTableCellElement>>(new Map());
  const isDraggingCol = useRef(false);
  const [activeModalColId, setActiveModalColId] = useState<number | null>(null);
  const [filterModal, setFilterModal] = useState(false);
  const filterWrapperRef = useRef<HTMLDivElement>(null);
  const [dateModal, setDateModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [calcModal, setCalcModal] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(new Set());
  const [sortColId, setSortColId] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [detailViewEntry, setDetailViewEntry] = useState<Entry | null>(null);
  const detailViewEntryIdRef = useRef<number | null>(null);
  useEffect(() => {
    detailViewEntryIdRef.current = detailViewEntry?.id || null;
  }, [detailViewEntry]);

  const [detailEdits, setDetailEdits] = useState<Record<string, string>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string | null>>({});
  const detailErrorsRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    detailErrorsRef.current = detailErrors;
  }, [detailErrors]);
  const detailInputRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // New column form (shared by Add Column and Insert Column)
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [newColDropdownOpts, setNewColDropdownOpts] = useState('');
  const [newColFormula, setNewColFormula] = useState('');

  // Change column type
  const [changeTypeValue, setChangeTypeValue] = useState('text');

  // Rename column
  const [renameColValue, setRenameColValue] = useState('');

  // Dropdown config
  const [dropdownConfigOptions, setDropdownConfigOptions] = useState('');

  // Filter
  const [filters, setFilters] = useState<Array<{ columnId: number; operator: string; value: string; value2?: string }>>(() => {
    const saved = localStorage.getItem(`rb_filters_${registerId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeFilters, setActiveFilters] = useState<Array<{ columnId: number; operator: string; value: string; value2?: string }>>(() => {
    const saved = localStorage.getItem(`rb_active_filters_${registerId}`);
    return saved ? JSON.parse(saved) : [];
  });

  const deferredSearch = useDeferredValue(search);
  const deferredActiveFilters = useDeferredValue(activeFilters);

  // Date picker for cell — refs to avoid re-render on open
  const [dateDay, setDateDay] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateYear, setDateYear] = useState('');
  const dateEntryIdRef = useRef<number | null>(null);
  const dateColumnIdRef = useRef<number | null>(null);
  const dateRectRef = useRef<{ top: number, bottom: number, left: number, width: number } | null>(null);
  // Expose as stable getters for OtherModals
  const dateEntryId = dateEntryIdRef.current;
  const dateColumnId = dateColumnIdRef.current;
  const dateRect = dateRectRef.current;

  // Dropdown for cell — refs to avoid re-render on open
  const dropdownOptionsRef = useRef<string[]>([]);
  const dropdownEntryIdRef = useRef<number | null>(null);
  const dropdownColumnIdRef = useRef<number | null>(null);
  const dropdownRectRef = useRef<{ top: number, bottom: number, left: number, width: number } | null>(null);
  const dropdownOptions = dropdownOptionsRef.current;
  const dropdownEntryId = dropdownEntryIdRef.current;
  const dropdownColumnId = dropdownColumnIdRef.current;
  const dropdownRect = dropdownRectRef.current;

  // Share
  const [sharePhone, setSharePhone] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');

  // Rename page
  const [renamePageId, setRenamePageId] = useState<number | null>(null);
  const [renamePageValue, setRenamePageValue] = useState('');

  // Calc modal
  const [calcColId] = useState<number | null>(null);
  const [calcMenu, setCalcMenu] = useState<{ colId: number; rect: DOMRect } | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── History (Undo/Redo) ──
  const undoStack = useRef<any[]>([]);
  const redoStack = useRef<any[]>([]);
  const isHistoryAction = useRef(false);
  const initialValues = useRef<Record<string, string>>({});

  const pushToUndoStack = useCallback((action: any) => {
    if (isHistoryAction.current) return;
    undoStack.current.push(action);
    redoStack.current = [];
    if (undoStack.current.length > 50) undoStack.current.shift();
  }, []);

  const undo = useCallback(async () => {
    const action = undoStack.current.pop();
    if (!action) {
      toast('Nothing to undo', { icon: 'ℹ️' });
      return;
    }

    isHistoryAction.current = true;
    try {
      if (action.type === 'EDIT_CELL') {
        // Optimistic local update first for instant feedback
        const patch = (prev: any) => prev.map((e: any) => 
          e.id === action.entryId ? { ...e, cells: { ...e.cells, [action.columnId]: action.oldValue } } : e
        );
        setLocalEntries(prev => patch(prev));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          return { ...old, entries: patch(old.entries) };
        });

        // Persist in background
        await updateEntry(registerId, action.entryId, { [action.columnId]: action.oldValue });
        redoStack.current.push(action);
        toast.success('Undone cell edit');

      } else if (action.type === 'BULK_EDIT_CELLS') {
        const updates: Record<string, string> = {};
        action.changes.forEach((c: any) => { updates[c.columnId] = c.oldValue; });

        const patch = (prev: any) => prev.map((e: any) => 
          e.id === action.entryId ? { ...e, cells: { ...e.cells, ...updates } } : e
        );
        setLocalEntries(prev => patch(prev));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          return { ...old, entries: patch(old.entries) };
        });

        await updateEntry(registerId, action.entryId, updates);
        redoStack.current.push(action);
        toast.success('Undone bulk edit');

      } else if (action.type === 'REORDER_COLUMN') {
        await reorderColumn(registerId, action.columnId, action.oldIndex);
        queryClient.invalidateQueries({ queryKey: ['register', registerId] });
        redoStack.current.push(action);
        toast.success('Undone column move');

      } else if (action.type === 'RENAME_COLUMN') {
        await renameColumn(registerId, action.columnId, action.oldName);
        queryClient.invalidateQueries({ queryKey: ['register', registerId] });
        redoStack.current.push(action);
        toast.success('Undone rename');

      } else if (action.type === 'ADD_ENTRY') {
        // Optimistic remove from local state
        setLocalEntries(prev => prev.filter(e => e.id !== action.entryId));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          const entries = old.entries.filter((e: any) => e.id !== action.entryId);
          return { ...old, entries, entryCount: entries.length };
        });

        await deleteEntry(registerId, action.entryId);
        redoStack.current.push(action);
        toast.success('Undone row addition');

      } else if (action.type === 'DELETE_ENTRY') {
        // Restore entry at its original position with exact same ID and data
        const entryToRestore = { ...action.entry };

        // Optimistic: insert back into local state at original index
        setLocalEntries(prev => {
          const next = [...prev];
          const idx = Math.min(action.index ?? next.length, next.length);
          next.splice(idx, 0, entryToRestore);
          return next;
        });
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          const entries = [...old.entries];
          const idx = Math.min(action.index ?? entries.length, entries.length);
          entries.splice(idx, 0, entryToRestore);
          return { ...old, entries, entryCount: entries.length };
        });

        // Persist using restoreEntry which keeps the original ID
        await restoreEntry(registerId, entryToRestore, action.index);
        redoStack.current.push(action);
        toast.success('Restored deleted row');

      } else if (action.type === 'BULK_DELETE_ENTRIES') {
        // Restore all deleted entries at their original positions
        const entriesToRestore: { entry: Entry; index: number }[] = action.entries;

        // Optimistic: re-insert all entries
        setLocalEntries(prev => {
          const next = [...prev];
          const sorted = [...entriesToRestore].sort((a, b) => a.index - b.index);
          for (const { entry, index } of sorted) {
            const idx = Math.min(index, next.length);
            next.splice(idx, 0, entry);
          }
          return next;
        });
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          const entries = [...old.entries];
          const sorted = [...entriesToRestore].sort((a, b) => a.index - b.index);
          for (const { entry, index } of sorted) {
            const idx = Math.min(index, entries.length);
            entries.splice(idx, 0, entry);
          }
          return { ...old, entries, entryCount: entries.length };
        });

        await bulkRestoreEntries(registerId, entriesToRestore);
        redoStack.current.push(action);
        toast.success(`Restored ${entriesToRestore.length} deleted rows`);

      } else if (action.type === 'DELETE_COLUMN') {
        // Restore column definition + all cell data for that column
        const restoredReg = await restoreColumn(registerId, action.column, action.cellData);
        queryClient.setQueryData(['register', registerId], restoredReg);
        setLocalEntries(restoredReg.entries || []);
        redoStack.current.push(action);
        toast.success(`Restored column "${action.column.name}"`);
      }
    } catch (err) {
      console.error('Undo failed:', err);
      toast.error('Failed to undo');
      // Re-fetch to recover from any partial state
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    } finally {
      isHistoryAction.current = false;
    }
  }, [registerId, queryClient]);

  const redo = useCallback(async () => {
    const action = redoStack.current.pop();
    if (!action) {
      toast('Nothing to redo', { icon: 'ℹ️' });
      return;
    }

    isHistoryAction.current = true;
    try {
      if (action.type === 'EDIT_CELL') {
        const patch = (prev: any) => prev.map((e: any) => 
          e.id === action.entryId ? { ...e, cells: { ...e.cells, [action.columnId]: action.newValue } } : e
        );
        setLocalEntries(prev => patch(prev));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          return { ...old, entries: patch(old.entries) };
        });

        await updateEntry(registerId, action.entryId, { [action.columnId]: action.newValue });
        undoStack.current.push(action);
        toast.success('Redone cell edit');

      } else if (action.type === 'BULK_EDIT_CELLS') {
        const updates: Record<string, string> = {};
        action.changes.forEach((c: any) => { updates[c.columnId] = c.newValue; });

        const patch = (prev: any) => prev.map((e: any) => 
          e.id === action.entryId ? { ...e, cells: { ...e.cells, ...updates } } : e
        );
        setLocalEntries(prev => patch(prev));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          return { ...old, entries: patch(old.entries) };
        });

        await updateEntry(registerId, action.entryId, updates);
        undoStack.current.push(action);
        toast.success('Redone bulk edit');

      } else if (action.type === 'REORDER_COLUMN') {
        await reorderColumn(registerId, action.columnId, action.newIndex);
        queryClient.invalidateQueries({ queryKey: ['register', registerId] });
        undoStack.current.push(action);
        toast.success('Redone column move');

      } else if (action.type === 'RENAME_COLUMN') {
        await renameColumn(registerId, action.columnId, action.newName);
        queryClient.invalidateQueries({ queryKey: ['register', registerId] });
        undoStack.current.push(action);
        toast.success('Redone rename');

      } else if (action.type === 'ADD_ENTRY') {
        // Redo adding a row — use restoreEntry to keep the same ID
        const restoredEntry = action.restoredEntry;
        if (restoredEntry) {
          setLocalEntries(prev => [...prev, restoredEntry]);
          queryClient.setQueryData(['register', registerId], (old: any) => {
            if (!old) return old;
            return { ...old, entries: [...old.entries, restoredEntry], entryCount: old.entries.length + 1 };
          });
          await restoreEntry(registerId, restoredEntry);
        } else {
          const newEntry = await addEntry(registerId, {}, action.pageIndex);
          action.entryId = newEntry.id;
          queryClient.invalidateQueries({ queryKey: ['register', registerId] });
        }
        undoStack.current.push(action);
        toast.success('Redone row addition');

      } else if (action.type === 'DELETE_ENTRY') {
        const entryId = action.entry.id;

        // Optimistic remove
        setLocalEntries(prev => prev.filter(e => e.id !== entryId));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          const entries = old.entries.filter((e: any) => e.id !== entryId);
          return { ...old, entries, entryCount: entries.length };
        });

        await deleteEntry(registerId, entryId);
        undoStack.current.push(action);
        toast.success('Redone row deletion');

      } else if (action.type === 'BULK_DELETE_ENTRIES') {
        const entryIds = action.entries.map((e: any) => e.entry.id);

        // Optimistic remove
        const idSet = new Set(entryIds);
        setLocalEntries(prev => prev.filter(e => !idSet.has(e.id)));
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          const entries = old.entries.filter((e: any) => !idSet.has(e.id));
          return { ...old, entries, entryCount: entries.length };
        });

        await bulkDeleteEntries(registerId, entryIds);
        undoStack.current.push(action);
        toast.success(`Redone deletion of ${entryIds.length} rows`);

      } else if (action.type === 'DELETE_COLUMN') {
        // Re-delete the column
        const updatedReg = await deleteColumn(registerId, action.column.id);
        queryClient.setQueryData(['register', registerId], updatedReg);
        setLocalEntries(updatedReg.entries || []);
        undoStack.current.push(action);
        toast.success(`Redone column deletion`);
      }
    } catch (err) {
      console.error('Redo failed:', err);
      toast.error('Failed to redo');
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    } finally {
      isHistoryAction.current = false;
    }
  }, [registerId, queryClient]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a modal or something? 
      // Actually, standard spreadsheet behavior is to undo even if focused.
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Column widths state for custom resizing
  const [colWidths, setColWidths] = useState<Record<number, number>>({});

  // ── Data ──
  // Combined query above handles data fetching for the register
  const errorRef = useRef<any>(null);
  useEffect(() => {
    if (error) {
      errorRef.current = error;
      toast.error('Failed to load register data');
    }
  }, [error]);

  // Note: cache busting removed — the in-memory cache is the source of truth.
  // Busting on every mount was causing data alteration on page refresh
  // because debounced writes might not have persisted yet.

  useEffect(() => {
    const unsubscribe = subscribeToMutationStatus((count) => {
      setIsSaving(count > 0);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving]);

  // Stabilize references so child components only re-render when the actual data changes
  const columns = useMemo(() => {
    return [...(register?.columns || [])].sort((a, b) => a.position - b.position);
  }, [register?.columns]);
  const pages = useMemo(() => register?.pages || [{ id: 1, name: 'Page 1', index: 0 }], [register?.pages]);

  useEffect(() => {
    const nextHidden = new Set<number>();
    const nextFrozen = new Set<number>();
    columns.forEach((col: any) => {
      if (col.hidden) nextHidden.add(col.id);
      if (col.frozen) nextFrozen.add(col.id);
    });
    setHiddenColumns(nextHidden);
    setFrozenColumns(nextFrozen);
    // Keep refs in sync for handlers that need latest data in closures
    columnsRef.current = columns;
    visibleColumnsRef.current = columns.filter(c => !nextHidden.has(c.id));
  }, [columns]);

  // Lock body scroll and handle back-button to close modal
  const modalOpenRef = useRef(false);
  useEffect(() => {
    if (detailViewEntry && !modalOpenRef.current) {
      modalOpenRef.current = true;
      document.body.classList.add('modal-open');
      // Push state to history so back button closes modal
      window.history.pushState({ modal: 'row-detail' }, '');
      
      const handlePopState = () => {
        // If we popped back and we were in a modal, close it
        setDetailViewEntry(null);
        setDetailEdits({});
        setDetailErrors({});
        modalOpenRef.current = false;
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('popstate', handlePopState);
        // Clean up history if modal closed via 'X' or Save
        if (modalOpenRef.current && window.history.state?.modal === 'row-detail') {
          modalOpenRef.current = false;
          window.history.back();
        }
      };
    } else if (!detailViewEntry && modalOpenRef.current) {
      modalOpenRef.current = false;
    }
  }, [detailViewEntry]);

  // Auto-initialize edit values when Row Detail view opens
  useEffect(() => {
    if (detailViewEntry && columns.length > 0) {
      const init: Record<string, string> = {};
      columns.filter(c => c.type !== 'formula').forEach(c => {
        init[c.id.toString()] = detailViewEntry.cells?.[c.id.toString()] || '';
      });
      setDetailEdits(init);
    }
  }, [detailViewEntry, columns]);

  // Sync localEntries ONLY when a network fetch returns a new register object instance
  const lastRegisterData = useRef<any>(cachedRegister);
  useEffect(() => {
    if (register && register !== lastRegisterData.current) {
      lastRegisterData.current = register;
      setLocalEntries(register.entries);
      localEntriesRef.current = register.entries;
      // Initialize column widths from saved data
      if (register.columns) {
        const widths: Record<number, number> = {};
        register.columns.forEach((col: any) => {
          if (col.width) widths[col.id] = col.width;
        });
        setColWidths(widths);
      }
    }
  }, [register]);

  // Also sync localEntriesRef on every local state change
  useEffect(() => {
    localEntriesRef.current = localEntries;
  }, [localEntries]);

  const handleCalcCellClick = (e: React.MouseEvent, colId: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCalcMenu({ colId, rect });
  };

  const handleImageDownload = useCallback(async (url: string) => {
    if (!url) return;
    try {
      // For data URLs or blobs, we can download directly
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `record_image_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // For external URLs, try to fetch to avoid browser opening in new tab
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `record_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback: just open in new tab if fetch fails (CORS)
      window.open(url, '_blank');
    }
  }, []);

  const updateCalcType = (colId: number, type: string) => {
    setCalcTypes(prev => ({ ...prev, [colId.toString()]: type as CalcType }));
    setCalcMenu(null);
  };

  useEffect(() => {
    if (calcMenu) {
      const h = () => setCalcMenu(null);
      window.addEventListener('click', h);
      return () => window.removeEventListener('click', h);
    }
  }, [calcMenu]);

  // Persist filter state to localStorage
  useEffect(() => {
    if (!registerId) return;
    localStorage.setItem(`rb_search_${registerId}`, search);
    localStorage.setItem(`rb_page_${registerId}`, currentPageIndex.toString());
    localStorage.setItem(`rb_filters_${registerId}`, JSON.stringify(filters));
    localStorage.setItem(`rb_active_filters_${registerId}`, JSON.stringify(activeFilters));
  }, [search, currentPageIndex, filters, activeFilters, registerId]);

  // Reset page to 0 when filters or search change to avoid being stuck on an empty page
  useEffect(() => {
    setCurrentPageIndex(0);
  }, [deferredSearch, deferredActiveFilters]);

  // Index entries by page index for O(1) page access
  const entriesByPage = useMemo(() => {
    const map: Record<number, Entry[]> = {};
    const len = localEntries.length;
    for (let i = 0; i < len; i++) {
      const e = localEntries[i];
      const p = e.pageIndex || 0;
      if (!map[p]) map[p] = [];
      map[p].push(e);
    }
    return map;
  }, [localEntries]);

  // Filter + sort entries — memoized so it only recomputes when inputs change
  const displayEntries = useMemo(() => {
    const s = deferredSearch.toLowerCase().trim();
    
    // Pre-calculate filter values once before the loop
    const preparedFilters = deferredActiveFilters.map(f => ({
      ...f,
      lFilter: (f.value || '').toLowerCase(),
      nValue: parseFloat(f.value),
      nValue2: parseFloat(f.value2 || '0'),
      dValue: f.value, // Date filters use YYYY-MM-DD string
      dValue2: f.value2 || '',
    }));

    let result = [];
    const filterLen = preparedFilters.length;
    const isSearching = !!s || filterLen > 0;
    const entriesToFilter = isSearching ? localEntries : (entriesByPage[currentPageIndex] || []);
    const localLen = entriesToFilter.length;

    for (let i = 0; i < localLen; i++) {
      const e = entriesToFilter[i];

      // 2. Search filtering
      if (s) {
        let match = false;
        const cells = e.cells || {};
        for (const key in cells) {
          const val = cells[key];
          if (val && typeof val === 'string' && val.toLowerCase().includes(s)) {
            match = true;
            break;
          }
        }
        if (!match) continue;
      }

      // 3. Active Filters
      if (filterLen > 0) {
        let passFilters = true;
        for (let j = 0; j < filterLen; j++) {
          const f = preparedFilters[j];
          const val = e.cells?.[f.columnId.toString()] || '';
          const lVal = val.toLowerCase();

          let condition = true;
          switch (f.operator) {
            case 'contains': condition = lVal.includes(f.lFilter); break;
            case 'not_contains': condition = !lVal.includes(f.lFilter); break;
            case 'equals': condition = lVal === f.lFilter; break;
            case 'not_equals': condition = lVal !== f.lFilter; break;
            case 'starts_with': condition = lVal.startsWith(f.lFilter); break;
            case 'ends_with': condition = lVal.endsWith(f.lFilter); break;
            case 'eq': condition = parseFloat(val) === f.nValue; break;
            case 'gt': condition = parseFloat(val) > f.nValue; break;
            case 'gte': condition = parseFloat(val) >= f.nValue; break;
            case 'lt': condition = parseFloat(val) < f.nValue; break;
            case 'lte': condition = parseFloat(val) <= f.nValue; break;
            case 'between': {
              const n = parseFloat(val);
              condition = n >= f.nValue && n <= f.nValue2;
              break;
            }
            case 'not_between': {
              const n = parseFloat(val);
              condition = n < f.nValue || n > f.nValue2;
              break;
            }
            case 'date_is': condition = parseDateString(val) === f.dValue; break;
            case 'date_not': condition = parseDateString(val) !== f.dValue; break;
            case 'date_before': condition = parseDateString(val) < f.dValue; break;
            case 'date_after': condition = parseDateString(val) > f.dValue; break;
            case 'date_between': {
              const dVal = parseDateString(val);
              condition = dVal >= f.dValue && dVal <= f.dValue2;
              break;
            }
            case 'date_not_between': {
              const dVal = parseDateString(val);
              condition = dVal < f.dValue || dVal > f.dValue2;
              break;
            }
            case 'empty': condition = !val; break;
            case 'not_empty': condition = !!val; break;
          }
          if (!condition) {
            passFilters = false;
            break;
          }
        }
        if (!passFilters) continue;
      }

      result.push(e);
    }

    // 4. Client-side Sorting (ensures visual consistency even if backend hasn't updated)
    if (sortColId && sortDir) {
      const colDef = columns.find(c => c.id === sortColId);
      const colIdStr = sortColId.toString();
      result.sort((a, b) => {
        const aVal = a.cells?.[colIdStr] || '';
        const bVal = b.cells?.[colIdStr] || '';
        if (colDef?.type === 'date') {
          const dA = parseDateString(aVal);
          const dB = parseDateString(bVal);
          return sortDir === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
        }
        if (colDef?.type === 'number' || colDef?.type === 'currency' || colDef?.type === 'formula') {
          const nA = parseFloat(aVal) || 0;
          const nB = parseFloat(bVal) || 0;
          return sortDir === 'asc' ? nA - nB : nB - nA;
        }
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return result;
  }, [localEntries, columns, deferredSearch, deferredActiveFilters, sortColId, sortDir, entriesByPage, currentPageIndex]);
  
  // ── Helpers ──
  const cleanOptions = (opts: string[]) => {
    const seen = new Set<string>();
    return opts
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => {
        const lower = s.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
  };


  // ── Mutations ──
  const addColumnMutation = useMutation({
    mutationFn: () => addColumn(registerId, {
      name: newColName, type: newColType,
      dropdownOptions: newColType === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
      formula: newColType === 'formula' ? newColFormula : undefined,
    }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      const dummyId = Date.now();
      if (prev) {
        const newCol = {
          id: dummyId, registerId, name: newColName, type: newColType,
          position: prev.columns ? prev.columns.length : 0,
          dropdownOptions: newColType === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
          formula: newColType === 'formula' ? newColFormula : undefined,
          createdAt: new Date().toISOString()
        };
        queryClient.setQueryData(['register', registerId], { ...prev, columns: [...(prev.columns || []), newCol] });
      }
      setNewColumnModal(false);
      return { prev, dummyId };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      // Force a re-fetch to ensure all sequential logic (auto-increment) is synced from server
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Column added successfully');
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to add column');
    },
    onSettled: () => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(registerId, colId),
    onMutate: async (colId) => {
      // Capture the full column definition + all cell data before deletion for undo
      const regData = queryClient.getQueryData(['register', registerId]) as any;
      if (regData) {
        const col = regData.columns?.find((c: any) => c.id.toString() === colId.toString());
        if (col) {
          const cellData: Record<string, string> = {};
          const colIdStr = colId.toString();
          (regData.entries || []).forEach((e: any) => {
            if (e.cells?.[colIdStr] !== undefined && e.cells[colIdStr] !== '') {
              cellData[e.id.toString()] = e.cells[colIdStr];
            }
          });
          pushToUndoStack({
            type: 'DELETE_COLUMN',
            column: { ...col },
            cellData,
          });
        }
      }
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setLocalEntries(updatedReg.entries || []);
      setColMenuId(null);
      toast.success('Column deleted');
    },
    onError: () => toast.error('Failed to delete column'),
  });

  const renameColumnMutation = useMutation({
    mutationFn: () => renameColumn(registerId, activeModalColId!, renameColValue),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev && activeModalColId !== null) {
        const oldName = prev.columns.find((c: any) => c.id === activeModalColId)?.name || '';
        pushToUndoStack({
          type: 'RENAME_COLUMN',
          columnId: activeModalColId,
          oldName,
          newName: renameColValue
        });

        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) => 
            c.id === activeModalColId ? { ...c, name: renameColValue } : c
          )
        });
      }
      setRenameColModal(false);
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Column renamed');
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to rename column');
    },
    onSettled: () => { setRenameColValue(''); setActiveModalColId(null); },
  });

  const updateDropdownMutation = useMutation({
    mutationFn: () => updateColumnDropdownOptions(registerId, activeModalColId!, cleanOptions(dropdownConfigOptions.split(','))),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setDropdownConfigModal(false);
      setActiveModalColId(null);
      toast.success('Dropdown options updated');
    },
    onError: () => toast.error('Failed to update options'),
  });

  const addDropdownOptionMutation = useMutation({
    mutationFn: ({ colId, newValue }: { colId: number; newValue: string }) => {
      const col = (register?.columns || []).find((c: any) => c.id === colId);
      const existingOptions = col?.dropdownOptions || [];
      const updatedOptions = cleanOptions([newValue, ...existingOptions]);
      return updateColumnDropdownOptions(registerId, colId, updatedOptions);
    },
    onMutate: async ({ colId, newValue }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) => 
            c.id === colId ? { ...c, dropdownOptions: cleanOptions([newValue, ...(c.dropdownOptions || [])]) } : c
          )
        });
      }
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Option added');
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to add option');
    },
  });

  const onAddDropdownOption = (colId: number, newValue: string, entryId?: number) => {
    addDropdownOptionMutation.mutate({ colId, newValue });
    
    // Also select it for the current entry immediately if entryId provided
    if (entryId != null) {
      setTimeout(() => {
        handleCellChange(entryId, colId.toString(), newValue);
      }, 0);
    }
  };

  const duplicateColumnMutation = useMutation({
    mutationFn: (colId: number) => duplicateColumn(registerId, colId),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setColMenuId(null);
      setLocalEntries(updatedReg.entries || []);
      toast.success('Column duplicated');
    },
    onError: () => toast.error('Failed to duplicate column'),
  });


  const moveColumnMutation = useMutation({
    mutationFn: ({ colId, dir }: { colId: number; dir: 'left' | 'right' }) => moveColumn(registerId, colId, dir),
    onMutate: async ({ colId, dir }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const cols = prev.columns.map((c: any) => ({ ...c }));
        const idx = cols.findIndex((c: any) => c.id === colId);
        const targetIdx = dir === 'left' ? idx - 1 : idx + 1;
        if (idx >= 0 && targetIdx >= 0 && targetIdx < cols.length) {
          [cols[idx], cols[targetIdx]] = [cols[targetIdx], cols[idx]];
          cols.forEach((c: any, i: number) => { c.position = i; });
          queryClient.setQueryData(['register', registerId], { ...prev, columns: cols });
        }
      }
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to move column');
    },
    onSettled: () => setColMenuId(null),
  });

  const reorderColumnMutation = useMutation({
    mutationFn: ({ colId, targetIndex }: { colId: number; targetIndex: number }) => reorderColumn(registerId, colId, targetIndex),
    onMutate: async ({ colId, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const cols = prev.columns.map((c: any) => ({ ...c }));
        const idx = cols.findIndex((c: any) => c.id === colId);
        if (idx !== -1) {
          // Push to undo stack
          pushToUndoStack({
            type: 'REORDER_COLUMN',
            columnId: colId,
            oldIndex: idx,
            newIndex: targetIndex
          });

          const [col] = cols.splice(idx, 1);
          const clampedTarget = Math.max(0, Math.min(targetIndex, cols.length));
          cols.splice(clampedTarget, 0, col);
          cols.forEach((c: any, i: number) => { c.position = i; });
          queryClient.setQueryData(['register', registerId], { ...prev, columns: cols });
        }
      }
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to reorder column');
    },
    onSettled: () => setColMenuId(null),
  });

  // ── Smooth column drag-and-drop handlers ──
  // Use refs so the mouse event closures always read the latest values
  const dragColIdRef = useRef<number | null>(null);
  const dropTargetIdxRef = useRef<number | null>(null);

  // These refs will be populated after visibleColumns/columns are defined
  const visibleColumnsRef = useRef<typeof columns>([]);
  const columnsRef = useRef<typeof columns>([]);
  const localEntriesRef = useRef<Entry[]>([]);

  const handleColDragMouseDown = useCallback((e: React.MouseEvent, colId: number) => {
    // Only left mouse button
    if (e.button !== 0) return;

    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement;
    if (!th) return;

    e.preventDefault(); // Prevent text selection during drag

    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let scrollRafId: number | null = null;
    let lastMouseX = 0;

    // Find the scrollable spreadsheet wrapper for auto-scroll
    const scrollContainer = th.closest('.spreadsheet-wrapper') as HTMLElement | null;

    // Auto-scroll loop: runs via requestAnimationFrame while dragging near edges
    const startAutoScroll = () => {
      if (scrollRafId !== null) return; // already running
      if (!scrollContainer) return;

      const edgeZone = 80; // px from edge to trigger scroll
      const maxSpeed = 30; // px per frame at the very edge

      const tick = () => {
        if (!isDraggingCol.current || !scrollContainer) { scrollRafId = null; return; }
        const rect = scrollContainer.getBoundingClientRect();
        const distFromLeft = lastMouseX - rect.left;
        const distFromRight = rect.right - lastMouseX;

        if (distFromLeft < edgeZone && distFromLeft > 0) {
          const speed = maxSpeed * (1 - distFromLeft / edgeZone);
          scrollContainer.scrollLeft -= speed;
        } else if (distFromRight < edgeZone && distFromRight > 0) {
          const speed = maxSpeed * (1 - distFromRight / edgeZone);
          scrollContainer.scrollLeft += speed;
        }
        scrollRafId = requestAnimationFrame(tick);
      };
      scrollRafId = requestAnimationFrame(tick);
    };

    const stopAutoScroll = () => {
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
        scrollRafId = null;
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      stopAutoScroll();

      if (dragGhostRef.current) {
        dragGhostRef.current.remove();
        dragGhostRef.current = null;
      }
      document.querySelectorAll('.col-drop-indicator').forEach(el => el.remove());

      isDraggingCol.current = false;
      dragColIdRef.current = null;
      dropTargetIdxRef.current = null;
      setDraggedColumnId(null);
      setDropTargetIdx(null);
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!started) {
        const dist = Math.sqrt((ev.clientX - startX) ** 2 + (ev.clientY - startY) ** 2);
        if (dist < 5) return;
        started = true;
        isDraggingCol.current = true;
        dragColIdRef.current = colId;
        setDraggedColumnId(colId);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // Create floating ghost
        const rect = th.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = 'col-drag-ghost';
        ghost.textContent = th.textContent || '';
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = `${ev.clientX - rect.width / 2}px`;
        ghost.style.top = `${ev.clientY - rect.height / 2}px`;
        document.body.appendChild(ghost);
        dragGhostRef.current = ghost;
      }

      // Move ghost
      if (dragGhostRef.current) {
        const gw = dragGhostRef.current.offsetWidth;
        const gh = dragGhostRef.current.offsetHeight;
        dragGhostRef.current.style.left = `${ev.clientX - gw / 2}px`;
        dragGhostRef.current.style.top = `${ev.clientY - gh / 2}px`;
      }

      // Auto-scroll when near the edges of the spreadsheet container
      lastMouseX = ev.clientX;
      startAutoScroll();

      // Determine target column position
      const visCols = visibleColumnsRef.current;
      let bestIdx: number | null = null;
      colHeaderRefs.current.forEach((headerEl, _id) => {
        const rect = headerEl.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          const colIdx = visCols.findIndex(c => c.id === _id);
          if (colIdx !== -1) {
            const midX = rect.left + rect.width / 2;
            bestIdx = ev.clientX < midX ? colIdx : colIdx + 1;
          }
        }
      });

      // Remove previous indicators
      document.querySelectorAll('.col-drop-indicator').forEach(el => el.remove());

      if (bestIdx !== null) {
        dropTargetIdxRef.current = bestIdx;
        setDropTargetIdx(bestIdx);

        // Build sorted column elements list
        const cols = Array.from(colHeaderRefs.current.entries());
        const sortedCols = visCols.map(vc => {
          const entry = cols.find(([id]) => id === vc.id);
          return entry ? entry[1] : null;
        }).filter(Boolean) as HTMLTableCellElement[];

        let indicatorLeft = 0;
        let indicatorTop = 0;
        let indicatorHeight = 0;

        if (bestIdx <= 0 && sortedCols[0]) {
          const r = sortedCols[0].getBoundingClientRect();
          indicatorLeft = r.left;
          indicatorTop = r.top;
          indicatorHeight = r.height;
        } else if (bestIdx >= sortedCols.length && sortedCols[sortedCols.length - 1]) {
          const r = sortedCols[sortedCols.length - 1].getBoundingClientRect();
          indicatorLeft = r.right;
          indicatorTop = r.top;
          indicatorHeight = r.height;
        } else if (sortedCols[bestIdx]) {
          const r = sortedCols[bestIdx].getBoundingClientRect();
          indicatorLeft = r.left;
          indicatorTop = r.top;
          indicatorHeight = r.height;
        }

        if (indicatorHeight > 0) {
          const indicator = document.createElement('div');
          indicator.className = 'col-drop-indicator';
          indicator.style.cssText = `
            position: fixed; left: ${indicatorLeft - 2}px; top: ${indicatorTop}px;
            width: 4px; height: ${indicatorHeight}px;
            background: var(--navy, #1a237e); border-radius: 2px;
            z-index: 9999; pointer-events: none;
          `;
          document.body.appendChild(indicator);
        }
      }
    };

    const onMouseUp = () => {
      if (started && isDraggingCol.current) {
        const currentDropIdx = dropTargetIdxRef.current;
        const currentDragId = dragColIdRef.current;
        const visCols = visibleColumnsRef.current;
        const allCols = columnsRef.current;

        if (currentDropIdx !== null && currentDragId !== null) {
          const draggedVisIdx = visCols.findIndex(c => c.id === currentDragId);

          if (draggedVisIdx !== -1 && currentDropIdx !== draggedVisIdx && currentDropIdx !== draggedVisIdx + 1) {
            let targetFullIdx: number;
            if (currentDropIdx >= visCols.length) {
              const lastVisCol = visCols[visCols.length - 1];
              targetFullIdx = allCols.findIndex(c => c.id === lastVisCol.id) + 1;
            } else {
              const targetVisCol = visCols[currentDropIdx];
              targetFullIdx = allCols.findIndex(c => c.id === targetVisCol.id);
            }
            const dragFullIdx = allCols.findIndex(c => c.id === currentDragId);
            if (dragFullIdx < targetFullIdx) targetFullIdx--;

            reorderColumnMutation.mutate({ colId: currentDragId, targetIndex: targetFullIdx });
          }
        }
      }
      cleanup();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [reorderColumnMutation]);

  const updateColumnWidthMutation = useMutation({
    mutationFn: ({ colId, width }: { colId: number; width: number }) => updateColumnWidth(registerId, colId, width),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
    },
    onError: (err) => {
      console.error('Failed to save column width:', err);
      toast.error('Failed to save column width');
    },
  });

  const handleColResizeMouseDown = useCallback((e: React.MouseEvent, colId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const th = colHeaderRefs.current.get(colId);
    if (!th) return;

    const innerDiv = th.querySelector('.col-header-inner') as HTMLElement;
    if (!innerDiv) return;

    const startX = e.clientX;
    const startWidth = innerDiv.offsetWidth;

    let styleTag = document.getElementById('col-resize-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'col-resize-style';
      document.body.appendChild(styleTag);
    }

    let dragLine = document.getElementById('col-resize-line');
    if (!dragLine) {
      dragLine = document.createElement('div');
      dragLine.id = 'col-resize-line';
      dragLine.style.position = 'fixed';
      dragLine.style.top = '0';
      dragLine.style.bottom = '0';
      dragLine.style.width = '2px';
      dragLine.style.backgroundColor = 'var(--primary)';
      dragLine.style.zIndex = '9999';
      dragLine.style.pointerEvents = 'none';
      document.body.appendChild(dragLine);
    }
    dragLine.style.left = `${startX}px`;

    const colIdx = visibleColumnsRef.current.findIndex(c => c.id === colId);

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + (ev.clientX - startX));
      if (styleTag && colIdx !== -1) {
        styleTag.textContent = `
          html body .spreadsheet tr > :nth-child(${colIdx + 2}) {
            width: ${newWidth}px !important;
            min-width: ${newWidth}px !important;
            max-width: ${newWidth}px !important;
          }
          html body .spreadsheet tr > :nth-child(${colIdx + 2}) .col-header-inner {
            width: ${newWidth}px !important;
            min-width: ${newWidth}px !important;
            max-width: ${newWidth}px !important;
          }
          html body .spreadsheet td:nth-child(${colIdx + 2}) {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
        `;
      }
      if (dragLine) {
        dragLine.style.left = `${ev.clientX}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      const newWidth = Math.max(40, startWidth + (ev.clientX - startX));
      setColWidths(prev => ({ ...prev, [colId]: newWidth }));
      updateColumnWidthMutation.mutate({ colId, width: newWidth });
      
      if (styleTag) styleTag.textContent = ''; // Clear temp style
      if (dragLine) dragLine.remove();
      
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [updateColumnWidthMutation, registerId]);


  const changeColumnTypeMutation = useMutation({
    mutationFn: () => {
      if (activeModalColId === null) throw new Error('No column selected');
      return changeColumnType(registerId, activeModalColId, changeTypeValue, {
        formula: changeTypeValue === 'formula' ? newColFormula : undefined,
        dropdownOptions: changeTypeValue === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
      });
    },
    onSuccess: (updatedReg) => {
      // We now receive the full register from the backend to ensure entries are synced (e.g. for auto_increment)
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      // Invalidate to ensure any formula or sequential changes are fully propagated
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      
      setChangeTypeModal(false); 
      setActiveModalColId(null);
      setNewColFormula('');
      setNewColDropdownOpts('');
      toast.success('Column type updated successfully');
    },
    onError: (err: any) => {
      console.error('Failed to change column type:', err);
      toast.error('Failed to update column type. Please try again.');
    }
  });

  const clearColumnDataMutation = useMutation({
    mutationFn: (colId: number) => clearColumnData(registerId, colId),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      setColMenuId(null);
      toast.success('Column data cleared');
    },
    onError: () => toast.error('Failed to clear column data'),
  });

  const insertColumnMutation = useMutation({
    mutationFn: () => {
      const col = columns.find((c) => c.id === activeModalColId);
      const pos = col ? (insertColModal === 'left' ? col.position : col.position + 1) : columns.length;
      return insertColumn(registerId, {
        name: newColName, type: newColType,
        dropdownOptions: newColType === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
        formula: newColType === 'formula' ? newColFormula : undefined,
      }, pos);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      const dummyId = Date.now();
      if (prev) {
        const colNode = prev.columns?.find((c: any) => c.id === activeModalColId);
        const pos = colNode ? (insertColModal === 'left' ? colNode.position : colNode.position + 1) : (prev.columns?.length || 0);
        
        const newCol = {
          id: dummyId,
          registerId,
          name: newColName,
          type: newColType,
          position: pos,
          dropdownOptions: newColType === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
          formula: newColType === 'formula' ? newColFormula : undefined,
          createdAt: new Date().toISOString()
        };
        
        const newColumns = (prev.columns || []).map((c: any) => 
          c.position >= pos ? { ...c, position: c.position + 1 } : c
        );
        newColumns.push(newCol);
        newColumns.sort((a: any, b: any) => a.position - b.position);

        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: newColumns
        });
      }
      setInsertColModal(null);
      setActiveModalColId(null);
      return { prev, dummyId };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Column inserted successfully');
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to insert column');
    },
    onSettled: () => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); },
  });

  const addEntryMutation = useMutation({
    mutationFn: () => addEntry(registerId, {}, currentPageIndex),
    onMutate: async () => {
      // Optimistic: add a temporary row instantly
      const currentPageRows = localEntries.filter((e) => (e.pageIndex || 0) === currentPageIndex).length;
      const tempEntry: Entry = {
        id: Date.now(),
        registerId,
        rowNumber: currentPageRows + 1,
        cells: {},
        createdAt: new Date().toISOString(),
        pageIndex: currentPageIndex,
      };
      setLocalEntries((prev) => [...prev, tempEntry]);
      return { tempId: tempEntry.id };
    },
    onSuccess: (newEntry, _vars, context) => {
      // Push to undo stack
      pushToUndoStack({ type: 'ADD_ENTRY', entryId: newEntry.id, pageIndex: currentPageIndex });

      // Replace temp entry with real entry from server
      setLocalEntries((prev) => prev.map((e) => e.id === context?.tempId ? newEntry : e));
      // Patch the cache: replace temp if present, otherwise append (upsert)
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const hasTempEntry = old.entries.some((e: any) => e.id === context?.tempId);
        const updatedEntries = hasTempEntry
          ? old.entries.map((e: any) => e.id === context?.tempId ? newEntry : e)
          : [...old.entries, newEntry];
        return { ...old, entries: updatedEntries, entryCount: updatedEntries.length };
      });
    },
    onError: (_err, _vars, context) => {
      // Roll back temp entry
      setLocalEntries((prev) => prev.filter((e) => e.id !== context?.tempId));
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => deleteEntry(registerId, entryId),
    onMutate: async (entryId) => {
      // Deep-clone entry + cells for undo — ensures data survives state mutations
      const entry = localEntries.find(e => e.id === entryId);
      const index = localEntries.findIndex(e => e.id === entryId);
      if (entry) {
        pushToUndoStack({
          type: 'DELETE_ENTRY',
          entry: { ...entry, cells: { ...entry.cells } },
          index,
        });
      }
    },
    onSuccess: (_data, entryId) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const entries = old.entries.filter((e: any) => e.id !== entryId);
        return { ...old, entries, entryCount: entries.length };
      });
      setLocalEntries(prev => prev.filter(e => e.id !== entryId));
      setRowMenuId(null);
    },
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: (entryId: number) => duplicateEntry(registerId, entryId),
    onSuccess: (newEntry) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, entries: [...old.entries, newEntry], entryCount: old.entries.length + 1 };
      });
      setLocalEntries(prev => [...prev, newEntry]);
      setRowMenuId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => bulkDeleteEntries(registerId, Array.from(selectedRows)),
    onMutate: async () => {
      // Capture all selected entries with their indices for undo
      const deletedIds = Array.from(selectedRows);
      const capturedEntries: { entry: Entry; index: number }[] = [];
      localEntries.forEach((e, idx) => {
        if (deletedIds.includes(e.id)) {
          capturedEntries.push({ entry: { ...e, cells: { ...e.cells } }, index: idx });
        }
      });
      if (capturedEntries.length > 0) {
        pushToUndoStack({ type: 'BULK_DELETE_ENTRIES', entries: capturedEntries });
      }
    },
    onSuccess: () => {
      const deletedIds = Array.from(selectedRows);
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const entries = old.entries.filter((e: any) => !deletedIds.includes(e.id));
        return { ...old, entries, entryCount: entries.length };
      });
      setLocalEntries(prev => prev.filter(e => !deletedIds.includes(e.id)));
      setSelectedRows(new Set());
    },
  });

  const addPageMutation = useMutation({
    mutationFn: () => addPage(registerId),
    onSuccess: (newPage) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, pages: [...(old.pages || []), newPage] };
      });
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setCurrentPageIndex(newPage.index);
    },
  });

  const renamePageMutation = useMutation({
    mutationFn: () => renamePage(registerId, renamePageId!, renamePageValue),
    onSuccess: () => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((p: any) => p.id === renamePageId ? { ...p, name: renamePageValue } : p) };
      });
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setRenamePageModal(false);
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => deletePage(registerId, pageId),
    onSuccess: (_data, pageId) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const pages = old.pages.filter((p: any) => p.id !== pageId);
        const entries = old.entries.filter((e: any) => e.pageIndex !== old.pages.find((p: any) => p.id === pageId)?.index);
        return { ...old, pages, entries, entryCount: entries.length };
      });
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setCurrentPageIndex(0);
    },
  });

  const shareLinkMutation = useMutation({
    mutationFn: () => generateShareLink(registerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['register', registerId] }),
  });

  const addSharedUserMutation = useMutation({
    mutationFn: () => addSharedUser(registerId, sharePhone, sharePermission),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setSharePhone(''); },
  });

  const removeSharedUserMutation = useMutation({
    mutationFn: (userId: number) => removeSharedUser(registerId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['register', registerId] }),
  });

  // ── Validation Helper ──
  const validateCellValue = useCallback((col: any, value: string): { isValid: boolean; error: string | null } => {
    if (!value || value.trim() === '') return { isValid: true, error: null };

    if (col.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return { isValid: false, error: 'Invalid email format' };
    } else if (col.type === 'phone') {
      const phoneRegex = /^[\d\s+()-]{7,20}$/;
      if (!phoneRegex.test(value)) return { isValid: false, error: 'Invalid phone format (e.g. +91 1234567890)' };
    } else if (col.type === 'date') {
      // Allow partial typing in grid, but full validation in modal or on blur
      const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      if (!dateRegex.test(value)) return { isValid: false, error: 'Use DD/MM/YYYY format' };
      
      const parts = value.split('/');
      const d = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      if (m < 1 || m > 12) return { isValid: false, error: 'Invalid month (1-12)' };
      const daysInMonth = new Date(y, m, 0).getDate();
      if (d < 1 || d > daysInMonth) return { isValid: false, error: `Invalid day for this month (max ${daysInMonth})` };
      if (y < 1900 || y > 2100) return { isValid: false, error: 'Year must be between 1900-2100' };
    } else if (col.type === 'number' || col.type === 'currency') {
      const numericValue = value.replace(/[^0-9.-]/g, '');
      if (numericValue === '' || isNaN(parseFloat(numericValue))) return { isValid: false, error: 'Must be a valid number' };
    } else if (col.type === 'dropdown') {
      if (col.dropdownOptions && col.dropdownOptions.length > 0) {
         // Strict single choice: value must exactly match one of the options
         const isValidOption = col.dropdownOptions.includes(value);
         if (value.trim() !== '' && !isValidOption) return { isValid: false, error: `'${value}' is not a valid option` };
      }
    } else if (col.type === 'auto_increment') {
      return { isValid: false, error: 'System generated field' };
    }

    return { isValid: true, error: null };
  }, []);

  // ── Handlers ──
  const handleCellChange = useCallback((entryId: number, columnId: string, value: string) => {
    const col = columnsRef.current.find(c => c.id.toString() === columnId);
    if (!col) return;

    // ── System Columns Read-only ──
    if (col.type === 'auto_increment' || col.type === 'formula') return;

    // ── Type-Based Validation ──
    const validation = validateCellValue(col, value);
    if (!validation.isValid) {
      if (value.trim() !== '') {
        // For grid editing, we show a warning but allow the change (save as is)
        if (col.type === 'date' && value.length >= 10) {
          toast(validation.error, { icon: '⚠️' });
        } else if (col.type === 'dropdown' || col.type === 'email' || col.type === 'phone' || col.type === 'number' || col.type === 'currency') {
          toast(validation.error, { icon: '⚠️' });
        }
      }
    }

    // 1. Update local state instantly (optimistic)
    setLocalEntries((prev) => prev.map((e) => {
      if (e.id === entryId) {
        // If it's a dropdown, ensure we only store the new value (strict single choice)
        const updatedCells = { ...e.cells, [columnId]: value };
        return { ...e, cells: updatedCells };
      }
      return e;
    }));

    // Sync with Row Detail Modal if open for this entry
    if (detailViewEntryIdRef.current === entryId) {
      setDetailEdits(prev => ({ ...prev, [columnId]: value }));
      if (detailErrorsRef.current[columnId]) setDetailErrors(prev => ({ ...prev, [columnId]: null }));
    }

    // 2. Debounce the Firestore write — no invalidateQueries, just patch the cache
    const key = `${entryId}-${columnId}`;
    
    // Capture initial value before the first keystroke of this session
    if (!debounceTimers.current[key]) {
      const entry = localEntriesRef.current.find(e => e.id === entryId);
      initialValues.current[key] = entry?.cells?.[columnId] || '';
    }

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      const oldVal = initialValues.current[key];
      // Only push to undo stack if the value actually changed
      if (oldVal !== value) {
        pushToUndoStack({
          type: 'EDIT_CELL',
          entryId,
          columnId,
          oldValue: oldVal,
          newValue: value
        });
      }
      // Session finished, clear initial value
      delete initialValues.current[key];
      delete debounceTimers.current[key];

      updateEntry(registerId, entryId, { [columnId]: value }).then(() => {
        // Only patch the cache entry, never re-fetch the whole register
        queryClient.setQueryData(['register', registerId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            entries: old.entries.map((e: any) =>
              e.id === entryId ? { ...e, cells: { ...e.cells, [columnId]: value } } : e
            ),
          };
        });
      });
    }, 600);
  }, [registerId, queryClient, pushToUndoStack]);

  // Excel-like sort: permanently reorders localEntries and persists to Firestore
  const handleSort = useCallback((colId: number, direction: 'asc' | 'desc') => {
    setSortColId(colId);
    setSortDir(direction);

    const colDef = columns.find(c => c.id === colId);
    const colIdStr = colId.toString();

    setLocalEntries(prev => {
      const sorted = [...prev].sort((a, b) => {
        // Only sort entries on the current page; leave other pages untouched
        const aPage = a.pageIndex || 0;
        const bPage = b.pageIndex || 0;
        if (aPage !== currentPageIndex || bPage !== currentPageIndex) return 0;

        const aVal = a.cells?.[colIdStr] || '';
        const bVal = b.cells?.[colIdStr] || '';

        if (colDef?.type === 'date') {
          const dA = parseDateString(aVal);
          const dB = parseDateString(bVal);
          return direction === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
        }

        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return direction === 'asc' ? aNum - bNum : bNum - aNum;
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });

      // Persist sorted order to Firestore
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, entries: sorted };
      });
      // Fire Firestore write via the mutation queue
      updateEntriesOrder(registerId, sorted).catch(err => {
        console.error('Failed to save sorted order:', err);
      });

      return sorted;
    });
  }, [columns, currentPageIndex, registerId, queryClient]);

  const openDatePicker = useCallback((entryId: number, colId: number, currentVal: string, rect?: DOMRect) => {
    // Support various separators like /, . or - for parsing
    const parts = (currentVal || '').split(/[./-]/);
    setDateDay(parts[0] || ''); setDateMonth(parts[1] || ''); setDateYear(parts[2] || '');
    dateEntryIdRef.current = entryId;
    dateColumnIdRef.current = colId;
    dateRectRef.current = rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width } : null;
    setDateModal(true);
  }, []);

  const handleDateSelect = (d?: string, m?: string, y?: string) => {
    // Basic day-month-year validation already happened in OtherModals or is passed in
    const finalD = d || dateDay;
    const finalM = m || dateMonth;
    const finalY = y || dateYear;
    
    // Sync state in case we need it for other UI
    if (d) setDateDay(d);
    if (m) setDateMonth(m);
    if (y) setDateYear(y);

    const dateStr = `${finalD.padStart(2, '0')}/${finalM.padStart(2, '0')}/${finalY}`;
    
    if (dateEntryId != null && dateColumnId != null) {
      const col = columns.find(c => c.id === dateColumnId);
      const validation = validateCellValue(col, dateStr);
      
      if (!validation.isValid) {
        toast(validation.error, { icon: '⚠️' });
      }
      
      handleCellChange(dateEntryId, dateColumnId.toString(), dateStr);
    }
    setDateModal(false);
  };

  const openDropdown = useCallback((entryId: number, colId: number, options: string[], rect?: DOMRect) => {
    dropdownEntryIdRef.current = entryId;
    dropdownColumnIdRef.current = colId;
    dropdownOptionsRef.current = options;
    dropdownRectRef.current = rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width } : null;
    setDropdownModal(true);
  }, []);

  const handleExportExcel = () => {
    if (!register) return;

    const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.id) && col.type !== 'image');
    const headerRow = ['S.No.', ...visibleColumns.map(c => c.name)];

    if (headerRow.length === 0) return;
    
    const dataAOA: any[][] = [headerRow];

    displayEntries.forEach((entry, idx) => {
      const rowData: any[] = [(idx + 1).toString()];
      visibleColumns.forEach(c => {
        const val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');
        
        if (c.type === 'number' || c.type === 'currency') {
          const cleaned = val.toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          rowData.push(isNaN(n) ? val : n);
        } else {
          rowData.push(val);
        }
      });
      dataAOA.push(rowData);
    });

    // ── Add Summation/Footer Row ──
    const footerRow: any[] = ['TOTALS'];
    let hasAnyCalc = false;
    visibleColumns.forEach(c => {
      const calcType = calcTypes[c.id] || (
        (c.type === 'number' || c.type === 'currency' || c.type === 'formula') ? 'sum' : 'count'
      );
      
      if (calcType === 'none') {
        footerRow.push('');
        return;
      }

      hasAnyCalc = true;
      const values = displayEntries.map(entry => {
        if (c.type === 'formula') return evaluateFormula(c.formula || '', entry, columns);
        return entry.cells?.[c.id.toString()] || '';
      });

      let calcValue: string | number = 0;
      if (calcType === 'empty') {
        calcValue = values.filter(v => v.trim() === '').length;
      } else if (calcType === 'filled' || calcType === 'count') {
        calcValue = values.filter(v => v.trim() !== '').length;
      } else if (calcType === 'distinct') {
        calcValue = new Set(values.filter(v => v.trim() !== '')).size;
      } else if (calcType === 'sum' || calcType === 'average' || calcType === 'min' || calcType === 'max') {
        const nums = values.map(v => {
          if (v === 'true') return 1;
          if (v === 'false' || !v) return 0;
          const cleaned = v.toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        });

        if (calcType === 'sum') {
          calcValue = nums.reduce((a, b) => a + b, 0);
        } else if (calcType === 'average') {
          calcValue = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
        } else if (calcType === 'min') {
          calcValue = nums.length > 0 ? Math.min(...nums) : 0;
        } else if (calcType === 'max') {
          calcValue = nums.length > 0 ? Math.max(...nums) : 0;
        }
      }

      const prefix = calcType === 'sum' ? 'SUM: ' : 
                     calcType === 'count' ? 'COUNT: ' : 
                     calcType === 'distinct' ? 'DISTINCT: ' : 
                     calcType === 'average' ? 'AVG: ' : 
                     calcType === 'min' ? 'MIN: ' : 
                     calcType === 'max' ? 'MAX: ' : '';
      footerRow.push(`${prefix}${calcValue}`);
    });

    if (hasAnyCalc) {
      dataAOA.push(footerRow);
    }

    try {
      const ws = XLSX.utils.aoa_to_sheet(dataAOA);
      
      const getColLetter = (n: number) => {
        let s = '';
        while (n >= 0) {
          s = String.fromCharCode(n % 26 + 65) + s;
          n = Math.floor(n / 26) - 1;
        }
        return s;
      };

      ws['!dataValidation'] = [];

      visibleColumns.forEach((c, cIdx) => {
        const colLetter = getColLetter(cIdx + 1); // +1 because we added S.No.

        if (c.type === 'dropdown' && c.dropdownOptions && c.dropdownOptions.length > 0) {
          const validationFormula = `"${c.dropdownOptions.join(',')}"`;
          if (validationFormula.length <= 255) {
            ws['!dataValidation'].push({
              sqref: `${colLetter}2:${colLetter}2000`,
              type: 'list',
              allowBlank: true,
              showDropDown: true,
              formula1: validationFormula
            });
          }
        }

        if (c.type === 'formula' && c.formula) {
          displayEntries.forEach((_, rIdx) => {
            let excelF = c.formula || '';
            visibleColumns.forEach((col, refIdx) => {
              const refLetter = getColLetter(refIdx + 1);
              excelF = excelF.replace(new RegExp(`\\{${col.name}\\}`, 'g'), `${refLetter}${rIdx + 2}`);
            });
            const cellRef = `${colLetter}${rIdx + 2}`;
            const val = evaluateFormula(c.formula || '', displayEntries[rIdx], columns);
            const n = parseFloat(val);
            ws[cellRef] = { t: isNaN(n) ? 's' : 'n', f: excelF, v: isNaN(n) ? val : n };
          });
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${register.name || 'Export'}.xlsx`);
    } catch (err) {
      console.error("Export Error: ", err);
      alert("Failed to export Excel file.");
    }
  };

  const handleExportPDF = () => {
    if (!register) return;

    const visibleCols = columns.filter((col) => !hiddenColumns.has(col.id) && col.type !== 'image');
    const headerRow = ['S.No.', ...visibleCols.map(c => c.name)];
    if (headerRow.length === 0) return;

    const bodyRows = displayEntries.map((entry, idx) => {
      return [
        (idx + 1).toString(),
        ...visibleCols.map(c => {
          const cellValue = c.type === 'formula'
            ? evaluateFormula(c.formula || '', entry, columns)
            : (entry.cells?.[c.id.toString()] || '');
          return cellValue;
        })
      ];
    });

    // ── Add Summation/Footer Row ──
    const footerRow: string[] = ['TOTALS'];
    let hasAnyCalc = false;
    visibleCols.forEach(c => {
      const calcType = calcTypes[c.id] || (
        (c.type === 'number' || c.type === 'currency' || c.type === 'formula') ? 'sum' : 'count'
      );
      
      if (calcType === 'none') {
        footerRow.push('');
        return;
      }

      hasAnyCalc = true;
      const values = displayEntries.map(entry => {
        if (c.type === 'formula') return evaluateFormula(c.formula || '', entry, columns);
        return entry.cells?.[c.id.toString()] || '';
      });

      let calcValue: string | number = 0;
      if (calcType === 'empty') {
        calcValue = values.filter(v => v.trim() === '').length;
      } else if (calcType === 'filled' || calcType === 'count') {
        calcValue = values.filter(v => v.trim() !== '').length;
      } else if (calcType === 'distinct') {
        calcValue = new Set(values.filter(v => v.trim() !== '')).size;
      } else if (calcType === 'sum' || calcType === 'average' || calcType === 'min' || calcType === 'max') {
        const nums = values.map(v => {
          if (v === 'true') return 1;
          if (v === 'false' || !v) return 0;
          const cleaned = v.toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        });

        if (calcType === 'sum') {
          calcValue = nums.reduce((a, b) => a + b, 0);
        } else if (calcType === 'average') {
          calcValue = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
        } else if (calcType === 'min') {
          calcValue = nums.length > 0 ? Math.min(...nums) : 0;
        } else if (calcType === 'max') {
          calcValue = nums.length > 0 ? Math.max(...nums) : 0;
        }
      }

      const prefix = calcType === 'sum' ? 'SUM: ' : 
                     calcType === 'count' ? 'COUNT: ' : 
                     calcType === 'distinct' ? 'DISTINCT: ' : 
                     calcType === 'average' ? 'AVG: ' : 
                     calcType === 'min' ? 'MIN: ' : 
                     calcType === 'max' ? 'MAX: ' : '';
      footerRow.push(`${prefix}${calcValue}`);
    });

    try {
      const doc = new jsPDF({ orientation: headerRow.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(register.name || 'Export', 14, 18);

      // Subtitle
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • ${displayEntries.length} rows`, 14, 24);
      doc.setTextColor(0, 0, 0);

      doc.setProperties({ title: register.name || 'Register Export' });

      autoTable(doc, {
        startY: 30,
        head: [['S.No.', ...headerRow]],
        body: bodyRows,
        foot: hasAnyCalc ? [footerRow] : undefined,
        theme: 'grid',
        tableWidth: 'auto',
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: 0,
        headStyles: {
          fillColor: [20, 83, 45],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          valign: 'middle',
        },
        footStyles: {
          fillColor: [230, 240, 230],
          textColor: [20, 83, 45],
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 2,
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          overflow: 'linebreak',
          minCellWidth: 10,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (data: any) => {
          // Footer with page number
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: 'center' }
          );
        },
      });

      doc.save(`${register.name || 'Export'}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF file.');
    }
  };

  // ── Row-level actions ──
  const handleRowDownloadPDF = useCallback((entryId: number) => {
    if (!register) return;
    const entry = localEntries.find(e => e.id === entryId);
    if (!entry) return;
    const visibleCols = columns.filter(col => !hiddenColumns.has(col.id) && col.type !== 'image');
    const rowIdx = localEntries.indexOf(entry) + 1;

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(register.name || 'Record', 14, 18);

      // Subtitle
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Row ${rowIdx} • Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 24);
      doc.setTextColor(0, 0, 0);

      const bodyRows = [
        ['S.No.', rowIdx.toString()],
        ...visibleCols.map(c => {
        const val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');
        return [c.name, val];
      })];

      autoTable(doc, {
        startY: 30,
        head: [['Field', 'Value']],
        body: bodyRows,
        theme: 'grid',
        headStyles: {
          fillColor: [20, 83, 45],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 4,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.2,
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50, fillColor: [240, 244, 240] },
          1: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${register.name || 'Record'}_Row${rowIdx}.pdf`);
    } catch (err) {
      console.error('Row PDF Error:', err);
      alert('Failed to export row as PDF.');
    }
  }, [register, localEntries, columns, hiddenColumns]);

  const handleRowDownloadExcel = useCallback((entryId: number) => {
    if (!register) return;
    const entry = localEntries.find(e => e.id === entryId);
    if (!entry) return;
    const visibleCols = columns.filter(col => !hiddenColumns.has(col.id) && col.type !== 'image');
    const rowIdx = localEntries.indexOf(entry) + 1;

    try {
      const headerRow = ['S.No.', ...visibleCols.map(c => c.name)];
      const dataRow = [(localEntries.indexOf(entry) + 1).toString(), ...visibleCols.map(c => {
        const val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');
        
        if (c.type === 'number' || c.type === 'currency') {
          const cleaned = val.toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          return isNaN(n) ? val : n;
        }
        return val;
      })];

      const ws = XLSX.utils.aoa_to_sheet([headerRow, dataRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Row Data');
      XLSX.writeFile(wb, `${register.name || 'Record'}_Row${rowIdx}.xlsx`);
    } catch (err) {
      console.error('Row Excel Error:', err);
      alert('Failed to export row as Excel.');
    }
  }, [register, localEntries, columns, hiddenColumns]);

  const handleRowShareText = useCallback((entryId: number) => {
    if (!register) return;
    const entry = localEntries.find(e => e.id === entryId);
    if (!entry) return;
    const visibleCols = columns.filter(col => !hiddenColumns.has(col.id) && col.type !== 'image');

    const lines = visibleCols.map(c => {
      const val = c.type === 'formula'
        ? evaluateFormula(c.formula || '', entry, columns)
        : (entry.cells?.[c.id.toString()] || '—');
      return `${c.name}: ${val}`;
    });

    const text = `📋 ${register.name}\n${'─'.repeat(30)}\n${lines.join('\n')}`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Row copied to clipboard!');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Row copied to clipboard!');
    });
  }, [register, localEntries, columns, hiddenColumns]);


  const toggleSelectRow = useCallback((id: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleMenu = useCallback((id: number) => {
    setRowMenuId(prev => (prev === id ? null : id));
  }, []);

  const visibleColumns = useMemo(() => {
    const visible = columns.filter((col) => !hiddenColumns.has(col.id));
    const frozen = visible.filter((col) => frozenColumns.has(col.id));
    const unfrozen = visible.filter((col) => !frozenColumns.has(col.id));
    return [...frozen, ...unfrozen];
  }, [columns, hiddenColumns, frozenColumns]);
  // Keep refs in sync for smooth drag handler closures
  visibleColumnsRef.current = visibleColumns;
  columnsRef.current = columns;

  // Memoize column width CSS so it doesn't recalculate on cell edits
  const colWidthsCss = useMemo(() => {
    return visibleColumns.map((col, idx) => {
      const w = colWidths[col.id] || 150;
      return `.spreadsheet tr>:nth-child(${idx + 2}){width:${w}px!important;min-width:${w}px!important;max-width:${w}px!important}.spreadsheet tr>:nth-child(${idx + 2}) .col-header-inner{width:${w}px!important;min-width:${w}px!important;max-width:${w}px!important}`;
    }).join('');
  }, [visibleColumns, colWidths]);

  // Defer formula/stats recalculation so it doesn't block keystrokes (Fix #3)
  // Optimized single-pass statistics calculation (Fix performance #4)
  const columnStats = useMemo(() => {
    if (!register || columns.length === 0) return {};
    
    const entriesToCalc = selectedRows.size > 0 
      ? displayEntries.filter(e => selectedRows.has(e.id)) 
      : displayEntries;

    if (entriesToCalc.length === 0) return {};

    // Initialize stats accumulators for all columns
    const colStatsData: Record<number, { type: CalcType; sum: number; count: number; min: number; max: number; distinct: Set<string> }> = {};
    const visibleColIds = new Set(visibleColumns.map(c => c.id));
    
    columns.forEach(col => {
      // Only calc if column is visible to save cycles
      if (!visibleColIds.has(col.id)) return;

      const isNumeric = col.type === 'number' || col.type === 'formula' || col.type === 'currency';
      const calcType = calcTypes[col.id] || (isNumeric ? 'sum' : 'count');
      
      if (calcType === 'none') return;

      colStatsData[col.id] = {
        type: calcType,
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        distinct: new Set<string>()
      };
    });

    const activeColIds = Object.keys(colStatsData).map(Number);
    if (activeColIds.length === 0) return {};

    // Map column IDs to objects for O(1) lookup in the loop
    const activeColsMap = new Map<number, any>();
    activeColIds.forEach(id => {
      const col = columns.find(c => c.id === id);
      if (col) activeColsMap.set(id, col);
    });

    // Single pass over entries to accumulate all stats
    const entryLen = entriesToCalc.length;
    for (let i = 0; i < entryLen; i++) {
      const e = entriesToCalc[i];
      for (let j = 0; j < activeColIds.length; j++) {
        const colId = activeColIds[j];
        const col = activeColsMap.get(colId);
        if (!col) continue;

        const s = colStatsData[colId];
        let val = '';
        if (col.type === 'formula') {
          val = evaluateFormula(col.formula || '', e, columns);
        } else {
          val = e.cells?.[colId.toString()] || '';
        }

        const trimmed = val.trim();
        
        if (s.type === 'empty') {
          if (trimmed === '') s.count++;
          continue;
        }
        if (s.type === 'filled' || s.type === 'count') {
          if (trimmed !== '') s.count++;
          continue;
        }
        if (s.type === 'distinct') {
          if (trimmed !== '') s.distinct.add(trimmed);
          continue;
        }

        // Numeric calculations
        let n: number;
        if (val === 'true') n = 1;
        else if (val === 'false') n = 0;
        else {
          n = parseFloat(val.replace(/[₹$,]/g, ''));
          if (isNaN(n)) n = 0;
        }

        s.sum += n;
        s.count++;
        if (n < s.min) s.min = n;
        if (n > s.max) s.max = n;
      }
    }

    // Finalize stats values
    const finalStats: Record<number, string | number> = {};
    activeColIds.forEach(colId => {
      const s = colStatsData[colId];
      if (s.type === 'empty' || s.type === 'filled' || s.type === 'count') {
        finalStats[colId] = s.count;
      } else if (s.type === 'distinct') {
        finalStats[colId] = s.distinct.size;
      } else if (s.type === 'sum') {
        finalStats[colId] = Number.isInteger(s.sum) ? s.sum : parseFloat(s.sum.toFixed(2));
      } else if (s.type === 'average') {
        const avg = s.sum / (entryLen || 1);
        finalStats[colId] = Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(2));
      } else if (s.type === 'min') {
        finalStats[colId] = s.min === Infinity ? 0 : s.min;
      } else if (s.type === 'max') {
        finalStats[colId] = s.max === -Infinity ? 0 : s.max;
      }
    });

    return finalStats;
  }, [register, columns, visibleColumns, displayEntries, selectedRows, calcTypes]);

  // ── Virtualization ──
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: displayEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => window.innerWidth < 768 ? 38 : 42, []),
    overscan: 30,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();
  
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalVirtualHeight - virtualRows[virtualRows.length - 1].end : 0;

  const frozenLeftOffsets = useMemo(() => {
    const offsets: Record<number, number> = {};
    let left = 50; // S.No column
    for (const vc of visibleColumns) {
      if (frozenColumns.has(vc.id)) {
        offsets[vc.id] = left;
        left += colWidths[vc.id] || 150;
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, colWidths]);


  if (isLoading) return (
    <div className="content-area">
      <div className="book-loader-wrapper">
        <div className="book-loader">
          <div className="page" />
          <div className="page" />
          <div className="page" />
        </div>
        <span className="center-loader-text" style={{ marginTop: '20px' }}>Loading register…</span>
      </div>
    </div>
  );
  if (!register) return <div className="empty-state"><p>Register not found</p></div>;

  return (
    <div className="content-area">
      {/* ── Header ── */}
      <div className="register-header">
        <button className="register-header-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={14} />
        </button>
        <h1 className="register-header-title">{register.name}</h1>
        <RegisterHeader 
          register={register} 
          setShareModal={setShareModal} 
          handleExportExcel={handleExportExcel}
          handleExportPDF={handleExportPDF}
        />
      </div>

      {/* ── Combined Pages + Actions Bar ── */}
      <div className="pages-actions-bar">
        {/* Left: Page tabs + Add Page + Add Column + Add Row */}
        <div className="pages-actions-tabs">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              className={`page-tab ${idx === currentPageIndex ? 'active' : ''}`}
              onClick={() => setCurrentPageIndex(idx)}
              onDoubleClick={() => { setRenamePageId(page.id); setRenamePageValue(page.name); setRenamePageModal(true); }}
            >
              <FileText size={11} style={{ flexShrink: 0 }} />
              {page.name}
              {pages.length > 1 && (
                <span
                  className="page-tab-close"
                  title={`Delete ${page.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${page.name}" and all its rows?`)) {
                      deletePageMutation.mutate(page.id);
                    }
                  }}
                >
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
          <button className="page-add-btn" onClick={() => addPageMutation.mutate()} title="Add Page" aria-label="Add Page">
            <Plus size={14} />
          </button>

          <div className="pab-divider" />

          {/* Add Column — next to tabs */}
          <button className="pab-tab-action-btn" title="Add Column"
            onClick={() => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); setNewColumnModal(true); }}>
            <Plus size={12} /><span>Add Column</span>
          </button>

          {/* Add Row — next to tabs, primary */}
          <button className="pab-tab-action-btn primary" onClick={() => addEntryMutation.mutate()}>
            <Plus size={12} /> Add Row
          </button>
        </div>

        {/* Right: stats + search + filter + contextual */}
        <div className="pages-actions-right">
          {/* Stats */}
          <span className="pab-stat"><Hash size={11} />{displayEntries.length} rows</span>
          <span className="pab-stat"><FileText size={11} />{columns.length} cols</span>

          <div className="pab-divider" />

          {/* Search */}
          <div className="pab-search" id="pab-search-wrap">
            <Search size={13} className="pab-search-icon" />
            <input
              id="pab-search-input"
              className="pab-search-input"
              placeholder="Search rows…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
            />
          </div>

          {/* Filter — highlighted button + inline dropdown panel */}
          <div className="pab-filter-wrapper" ref={filterWrapperRef}>
            <button
              className={`pab-filter-btn${activeFilters.length > 0 ? ' active' : ''}`}
              title={`Filter${activeFilters.length > 0 ? ` (${activeFilters.length} active)` : ''}`}
              onClick={() => {
                if (!filterModal) setFilters(activeFilters.length ? [...activeFilters] : []);
                setFilterModal(prev => !prev);
              }}
              aria-label="Filter"
            >
              <Filter size={14} />
              {activeFilters.length > 0 && <span className="pab-filter-count">{activeFilters.length}</span>}
            </button>
            <FilterModal
              filterModal={filterModal} setFilterModal={setFilterModal}
              filters={filters} setFilters={setFilters} setActiveFilters={setActiveFilters}
              columns={columns}
            />
          </div>

          <div className="pab-divider" />

          {/* Undo */}
          <button
            className={`pab-history-btn${undoStack.current.length > 0 ? '' : ' disabled'}`}
            title={`Undo${undoStack.current.length > 0 ? ` (${undoStack.current.length})` : ''} — Ctrl+Z`}
            onClick={undo}
            aria-label="Undo"
          >
            <Undo2 size={14} />
            {undoStack.current.length > 0 && <span className="pab-history-count">{undoStack.current.length}</span>}
          </button>

          {/* Redo */}
          <button
            className={`pab-history-btn${redoStack.current.length > 0 ? '' : ' disabled'}`}
            title={`Redo${redoStack.current.length > 0 ? ` (${redoStack.current.length})` : ''} — Ctrl+Y`}
            onClick={redo}
            aria-label="Redo"
          >
            <Redo2 size={14} />
            {redoStack.current.length > 0 && <span className="pab-history-count">{redoStack.current.length}</span>}
          </button>

          {/* Show hidden */}
          {hiddenColumns.size > 0 && (
            <button className="pab-icon-btn active" title={`Show ${hiddenColumns.size} hidden`}
              onClick={() => { setHiddenColumns(new Set()); hiddenColumns.forEach(c => hideColumn(registerId, c, false)); }}>
              <Eye size={13} />
              <span className="pab-badge">{hiddenColumns.size}</span>
            </button>
          )}

          {/* Bulk delete */}
          {selectedRows.size > 0 && (
            <button className="pab-icon-btn danger" title={`Delete ${selectedRows.size} rows`}
              onClick={() => { if (confirm(`Delete ${selectedRows.size} rows?`)) bulkDeleteMutation.mutate(); }}>
              <Trash2 size={13} />
              <span className="pab-badge">{selectedRows.size}</span>
            </button>
          )}
        </div>
      </div>




      {/* ── Dynamic Column Widths (memoized) ── */}
      <style dangerouslySetInnerHTML={{ __html: colWidthsCss }} />

      {/* ── Spreadsheet ── */}
      <div 
        ref={parentRef}
        className="spreadsheet-wrapper" 
        key={`grid-${columns.length}-${columns.map(c => c.id).join('-')}`}
      >
        <table className="spreadsheet">
          <thead>
            <tr>
              <th className="serial">S.NO.</th>
              {visibleColumns.map((col) => {
                const IconComponent = (() => {
                  const nameL = (col.name || '').toLowerCase();
                  const isPayment = nameL.includes('amount') || nameL.includes('fee') || nameL.includes('payment') || nameL.includes('balance') || nameL.includes('price');
                  if (isPayment && col.type !== 'currency') return <IndianRupee size={12} />;
                  switch (col.type) {
                    case 'number':         return <Hash size={12} />;
                    case 'auto_increment': return <ListOrdered size={12} />;
                    case 'currency':       return <IndianRupee size={12} />;
                    case 'date':           return <Calendar size={12} />;
                    case 'dropdown':       return <ChevronDown size={12} />;
                    case 'formula':        return <FlaskConical size={12} />;
                    case 'phone':          return <Phone size={12} />;
                    case 'email':          return <Mail size={12} />;
                    case 'url':            return <Globe size={12} />;
                    case 'rating':         return <Star size={12} />;
                    case 'checkbox':       return <CheckSquare size={12} />;
                    case 'image':          return <ImageIcon size={12} />;
                    default:               return <span className="col-type-text-icon">T</span>;
                  }
                })();

                const isFrozen = frozenColumns.has(col.id);
                const stickyLeft = isFrozen ? frozenLeftOffsets[col.id] : undefined;

                return (
                <th 
                  key={col.id} 
                  className={`col-header-cell ${draggedColumnId === col.id ? 'dragging' : ''}${isFrozen ? ' frozen-col' : ''}`}
                  ref={(el) => {
                    if (el) colHeaderRefs.current.set(col.id, el);
                    else colHeaderRefs.current.delete(col.id);
                  }}
                  style={isFrozen ? { position: 'sticky', left: stickyLeft, zIndex: 13, background: 'var(--border-light)' } : undefined}
                >
                  <div className="col-header-inner">
                    {IconComponent}
                    <span 
                      className="col-header-name"
                      title="Click for options, Drag to reorder"
                      onMouseDown={(e) => handleColDragMouseDown(e, col.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (colMenuId === col.id) {
                          setColMenuId(null);
                          setColMenuRect(null);
                        } else {
                          const th = (e.currentTarget as HTMLElement).closest('th');
                          if (th) setColMenuRect(th.getBoundingClientRect());
                          setColMenuId(col.id);
                        }
                      }}
                      style={{ cursor: 'default' }}
                    >
                      {col.name}
                      {col.type === 'formula' && <span className="col-formula-badge" title={col.formula}>Fx</span>}
                    </span>
                    {sortColId === col.id && sortDir && (
                      <span className="sort-indicator" title={sortDir === 'asc' ? 'Sorted A→Z' : 'Sorted Z→A'}>
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                    {frozenColumns.has(col.id) && <Pin size={10} color="var(--muted)" className="frozen-pin" />}
                    <div 
                      className="col-resize-handle"
                      onMouseDown={(e) => handleColResizeMouseDown(e, col.id)}
                    />
                  </div>
                </th>
              )})}
              <th className="actions" />
            </tr>
          </thead>
          <tbody style={{ height: `${totalVirtualHeight}px` }}>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} colSpan={visibleColumns.length + 2} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const entry = displayEntries[virtualRow.index];
              return (
                <SpreadsheetRow 
                  key={entry.id}
                  entry={entry}
                  idx={virtualRow.index}
                  visibleColumns={visibleColumns}
                  isSelected={selectedRows.has(entry.id)}
                  toggleSelectRow={toggleSelectRow}
                  handleCellChange={handleCellChange}
                  openDatePicker={openDatePicker}
                  openDropdown={openDropdown}
                  isMenuOpen={rowMenuId === entry.id}
                  toggleMenu={toggleMenu}
                  registerColumns={columns}
                  onRowDetail={setDetailViewEntry}
                  onImagePreview={setPreviewImage}
                  frozenColumns={frozenColumns}
                  frozenLeftOffsets={frozenLeftOffsets}
                  totalRows={displayEntries.length}
                />
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} colSpan={visibleColumns.length + 2} />
              </tr>
            )}
            {displayEntries.length === 0 && columns.length > 0 && [1, 2, 3].map((n) => (
              <tr key={`mock-${n}`} className="mock" onClick={() => addEntryMutation.mutate()}>
                <td className="serial">{n}</td>
                {visibleColumns.map((col) => (
                  <td key={col.id}><div className="mock-cell-content">&nbsp;</div></td>
                ))}
                <td className="actions" />
              </tr>
            ))}
          </tbody>
            {displayEntries.length > 0 && (
              <tfoot>
                <tr className="calc-row">
                  <td className="sticky-col sticky-col-1 calc-cell-td" style={{ background: 'var(--border-light)', textAlign: 'center' }}>
                    <span className="calc-label" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--navy)' }}>Σ</span>
                  </td>
                  {visibleColumns.map((col) => {
                    const isNumeric = col.type === 'number' || col.type === 'formula' || col.type === 'currency';
                    const calcType = calcTypes[col.id] || (isNumeric ? 'sum' : 'count');
                    const isFrozen = frozenColumns.has(col.id);
                    const leftOffset = isFrozen ? (frozenLeftOffsets[col.id] || 0) : 0;
                    
                    const calcValue = columnStats[col.id] ?? '-';
                    const displayValue = (col.type === 'currency' && typeof calcValue === 'number') 
                      ? formatCurrency(calcValue.toString()) 
                      : calcValue;

                    return (
                      <td
                        key={col.id}
                        className={`calc-cell-td ${isFrozen ? 'frozen-col' : ''}`}
                        style={isFrozen ? { position: 'sticky', left: leftOffset, zIndex: 11, background: 'var(--border-light)' } : undefined}
                      >
                        <div className="calc-cell-content" onClick={(e) => handleCalcCellClick(e, col.id)}>
                          <span className="calc-dropdown-icon">
                            <ChevronDown size={10} />
                          </span>
                          <span className="calc-label">
                            {calcType === 'sum' && 'Σ '}
                            {calcType === 'count' && 'N '}
                            {calcType === 'distinct' && 'D '}
                            {calcType === 'average' && 'μ '}
                            {calcType === 'none' ? 'CALC' : calcType.toUpperCase()}:
                          </span>
                          <span className="calc-value">{displayValue}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="calc-cell-td actions" style={{ background: 'var(--border-light)' }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      {/* ── Context Menus ── */}
      <RegisterContextMenus 
        colMenuId={colMenuId} colMenuRect={colMenuRect} setColMenuId={setColMenuId} columns={columns}
        setActiveModalColId={setActiveModalColId}
        handleSort={handleSort}
        setRenameColValue={setRenameColValue} setRenameColModal={setRenameColModal}
        setChangeTypeValue={setChangeTypeValue} setChangeTypeModal={setChangeTypeModal}
        setDropdownConfigOptions={setDropdownConfigOptions} setDropdownConfigModal={setDropdownConfigModal}
        duplicateColumnMutation={duplicateColumnMutation}
        setNewColName={setNewColName} setNewColType={setNewColType} setNewColDropdownOpts={setNewColDropdownOpts} setNewColFormula={setNewColFormula}
        setInsertColModal={setInsertColModal} moveColumnMutation={moveColumnMutation}
        frozenColumns={frozenColumns} setFrozenColumns={setFrozenColumns} freezeColumn={freezeColumn} registerId={registerId}
        hiddenColumns={hiddenColumns} setHiddenColumns={setHiddenColumns} hideColumn={hideColumn}
        clearColumnDataMutation={clearColumnDataMutation} deleteColumnMutation={deleteColumnMutation}
        rowMenuId={rowMenuId} setRowMenuId={setRowMenuId}
        duplicateEntryMutation={duplicateEntryMutation} deleteEntryMutation={deleteEntryMutation}
        handleRowDownloadPDF={handleRowDownloadPDF}
        handleRowDownloadExcel={handleRowDownloadExcel}
        handleRowShareText={handleRowShareText}
        calcTypes={calcTypes}
        updateCalcType={updateCalcType}
      />

      {/* ── Modals ── */}
      <ColumnModals 
        newColumnModal={newColumnModal} setNewColumnModal={setNewColumnModal}
        insertColModal={insertColModal} setInsertColModal={setInsertColModal}
        newColName={newColName} setNewColName={setNewColName}
        newColType={newColType} setNewColType={setNewColType}
        newColDropdownOpts={newColDropdownOpts} setNewColDropdownOpts={setNewColDropdownOpts}
        newColFormula={newColFormula} setNewColFormula={setNewColFormula}
        addColumnMutation={addColumnMutation} insertColumnMutation={insertColumnMutation}
        renameColModal={renameColModal} setRenameColModal={setRenameColModal}
        renameColValue={renameColValue} setRenameColValue={setRenameColValue} renameColumnMutation={renameColumnMutation}
        dropdownConfigModal={dropdownConfigModal} setDropdownConfigModal={setDropdownConfigModal}
        dropdownConfigOptions={dropdownConfigOptions} setDropdownConfigOptions={setDropdownConfigOptions} updateDropdownMutation={updateDropdownMutation}
        changeTypeModal={changeTypeModal} setChangeTypeModal={setChangeTypeModal}
        changeTypeValue={changeTypeValue} setChangeTypeValue={setChangeTypeValue} changeColumnTypeMutation={changeColumnTypeMutation}
        activeModalColId={activeModalColId}
        COL_TYPES={COL_TYPES}
        columns={columns}
        entries={localEntries}
      />


      <ShareModal 
        shareModal={shareModal} setShareModal={setShareModal}
        register={register} sharePhone={sharePhone} setSharePhone={setSharePhone}
        sharePermission={sharePermission} setSharePermission={setSharePermission}
        shareLinkMutation={shareLinkMutation} addSharedUserMutation={addSharedUserMutation} removeSharedUserMutation={removeSharedUserMutation}
      />

      <OtherModals 
        renamePageModal={renamePageModal} setRenamePageModal={setRenamePageModal}
        renamePageValue={renamePageValue} setRenamePageValue={setRenamePageValue} renamePageId={renamePageId}
        pages={pages} deletePageMutation={deletePageMutation} renamePageMutation={renamePageMutation}
        calcModal={calcModal} setCalcModal={setCalcModal} calcTypes={calcTypes} setCalcTypes={setCalcTypes as any} calcColId={calcColId}
        dateModal={dateModal} setDateModal={setDateModal}
        dateDay={dateDay} setDateDay={setDateDay} dateMonth={dateMonth} setDateMonth={setDateMonth} dateYear={dateYear} setDateYear={setDateYear}
        handleDateSelect={handleDateSelect} dateRect={dateRect}
        dropdownModal={dropdownModal} setDropdownModal={setDropdownModal}
        dropdownOptions={dropdownOptions} dropdownEntryId={dropdownEntryId} dropdownColumnId={dropdownColumnId}
        dropdownRect={dropdownRect}
        localEntries={localEntries} handleCellChange={handleCellChange}
        columns={columns}
        onAddDropdownOption={onAddDropdownOption}
      />

      {/* Row Detail View Modal (Direct Edit Mode) */}
      {detailViewEntry && (
        <div className="row-detail-overlay" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); }}>
          <div className="row-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="row-detail-header">
              <div className="row-detail-title">
                <span className="row-detail-badge">Row #{(localEntries.findIndex(e => e.id === detailViewEntry.id) + 1)}</span>
                <h2>Record Details</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className="register-header-btn"
                  style={{ border: '1px solid #dce4f5', background: '#fff', color: '#dc2626' }}
                  onClick={() => handleRowDownloadPDF(detailViewEntry.id)}
                  title="Download PDF"
                >
                  <FileText size={14} /> PDF
                </button>
                <button
                  className="register-header-btn"
                  style={{ border: '1px solid #dce4f5', background: '#fff', color: '#16a34a' }}
                  onClick={() => handleRowDownloadExcel(detailViewEntry.id)}
                  title="Download Excel"
                >
                  <Download size={14} /> Excel
                </button>
                <button className="row-detail-close" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); }} aria-label="Close">✕</button>
              </div>
            </div>
            <div className="row-detail-body">
              {(() => {
                const handleDetailKeyDown = (e: React.KeyboardEvent, currentId: number) => {
                  const currentIndex = columns.findIndex(c => c.id === currentId);
                  
                  if (e.key === 'Enter' || (e.key === 'ArrowDown' && (e.target as HTMLElement).tagName !== 'SELECT')) {
                    e.preventDefault();
                    const nextCol = columns[currentIndex + 1];
                    if (nextCol) {
                      detailInputRefs.current.get(nextCol.id)?.focus();
                    }
                  } else if (e.key === 'ArrowUp' && (e.target as HTMLElement).tagName !== 'SELECT') {
                    e.preventDefault();
                    const prevCol = columns[currentIndex - 1];
                    if (prevCol) {
                      detailInputRefs.current.get(prevCol.id)?.focus();
                    }
                  }
                };

                return columns.map((col) => {
                  const colKey = col.id.toString();
                  const val = detailEdits[colKey] ?? '';

                  return (
                    <div className={`row-detail-field ${col.type}-field`} key={col.id}>
                      <div className="row-detail-label-container">
                        <div className="row-detail-label-group">
                          <label className="row-detail-label">
                            {col.name}
                            {col.type === 'formula' && <FlaskConical size={10} style={{ marginLeft: 4, opacity: 0.6 }} />}
                          </label>
                          <span className="row-detail-type-badge">{col.type.replace('_', ' ')}</span>
                        </div>
                        <button 
                          className="row-detail-col-btn" 
                          title="Column Settings"
                          onClick={() => {
                            setActiveModalColId(col.id);
                            setChangeTypeValue(col.type);
                            if (col.type === 'formula') setNewColFormula(col.formula || '');
                            if (col.type === 'dropdown') setNewColDropdownOpts((col.dropdownOptions || []).join(', '));
                            setChangeTypeModal(true);
                          }}
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      
                      <div className="row-detail-input-wrapper">
                        {col.type === 'dropdown' ? (
                          <div className="row-detail-input-wrapper">
                            <div 
                              className={`row-detail-input cell-dropdown ${detailErrors[colKey] ? 'invalid' : ''}`}
                              tabIndex={0}
                              ref={(el) => {
                                if (el) detailInputRefs.current.set(col.id, el);
                                else detailInputRefs.current.delete(col.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  openDropdown(detailViewEntry.id, col.id, col.dropdownOptions || [], rect as DOMRect);
                                } else handleDetailKeyDown(e, col.id);
                              }}
                              onClick={(e) => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                openDropdown(detailViewEntry.id, col.id, col.dropdownOptions || [], rect as DOMRect);
                                if (detailErrors[colKey]) setDetailErrors(prev => ({ ...prev, [colKey]: null }));
                              }}
                            >
                              {val || 'Select options...'}
                            </div>
                            {detailErrors[colKey] && (
                              <div className="row-detail-error-msg">
                                <AlertCircle size={10} />
                                {detailErrors[colKey]}
                              </div>
                            )}
                          </div>
                        ) : col.type === 'checkbox' ? (
                          <div 
                            className="row-detail-checkbox-wrapper"
                            tabIndex={0}
                            ref={(el) => {
                              if (el) detailInputRefs.current.set(col.id, el);
                              else detailInputRefs.current.delete(col.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === ' ') {
                                e.preventDefault();
                                setDetailEdits(prev => ({ ...prev, [colKey]: (val === 'true' || val === 'Checked') ? 'false' : 'true' }));
                              } else {
                                handleDetailKeyDown(e, col.id);
                              }
                            }}
                            onClick={() => setDetailEdits(prev => ({ ...prev, [colKey]: (val === 'true' || val === 'Checked') ? 'false' : 'true' }))}
                          >
                            <input
                              type="checkbox"
                              checked={val === 'true' || val === 'Checked'}
                              readOnly
                            />
                            <span className="checkbox-label">{val === 'true' || val === 'Checked' ? 'Checked' : 'Unchecked'}</span>
                          </div>
                        ) : col.type === 'date' ? (
                          <div className="row-detail-input-wrapper">
                            <input 
                              type="text"
                              className={`row-detail-input cell-date ${detailErrors[colKey] ? 'invalid' : ''}`} 
                              value={val}
                              placeholder="DD/MM/YYYY"
                              autoComplete="off"
                              onChange={(e) => {
                                setDetailEdits(prev => ({ ...prev, [colKey]: e.target.value }));
                                if (detailErrors[colKey]) setDetailErrors(prev => ({ ...prev, [colKey]: null }));
                              }}
                              onClick={(e) => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                openDatePicker(detailViewEntry.id, col.id, val, rect as DOMRect);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  openDatePicker(detailViewEntry.id, col.id, val, rect as DOMRect);
                                } else {
                                  handleDetailKeyDown(e, col.id);
                                }
                              }}
                              ref={(el) => {
                                if (el) detailInputRefs.current.set(col.id, el);
                                else detailInputRefs.current.delete(col.id);
                              }}
                            />
                            {detailErrors[colKey] && (
                              <div className="row-detail-error-msg">
                                <AlertCircle size={10} />
                                {detailErrors[colKey]}
                              </div>
                            )}
                          </div>
                        ) : col.type === 'image' ? (
                          <div className="row-detail-image-field">
                            {val ? (
                              <div className="row-detail-image-container">
                                <div className="row-detail-img-wrapper" onClick={() => setPreviewImage(val)}>
                                  <img 
                                    src={val} 
                                    alt="preview" 
                                    className="row-detail-img-preview" 
                                  />
                                  <div className="row-detail-img-overlay">
                                    <Maximize2 size={24} color="white" />
                                    <span>Quick Reveal</span>
                                  </div>
                                </div>
                                <div className="row-detail-image-actions">
                                  <button className="row-detail-img-btn" onClick={() => setPreviewImage(val)}>View Large</button>
                                  <button className="row-detail-img-btn" onClick={() => handleImageDownload(val)}>Download</button>
                                  <button className="row-detail-img-btn danger" onClick={() => setDetailEdits(prev => ({ ...prev, [colKey]: '' }))}>Remove</button>
                                </div>
                              </div>
                            ) : (
                              <label className="row-detail-image-upload">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  hidden 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (rev) => {
                                        setDetailEdits(prev => ({ ...prev, [colKey]: rev.target?.result as string }));
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                                <ImageIcon size={16} />
                                <span>Upload Image</span>
                              </label>
                            )}
                          </div>
                        ) : col.type === 'formula' ? (
                          <div 
                            className="row-detail-formula-result"
                            tabIndex={0}
                            ref={(el) => {
                              if (el) detailInputRefs.current.set(col.id, el);
                              else detailInputRefs.current.delete(col.id);
                            }}
                            onKeyDown={(e) => handleDetailKeyDown(e, col.id)}
                            onClick={() => {
                              setActiveModalColId(col.id);
                              setNewColFormula(col.formula || '');
                              setCalcModal(true);
                            }}
                            title="Click to edit formula"
                          >
                            {evaluateFormula(col.formula || '', { ...detailViewEntry, cells: { ...detailViewEntry.cells, ...detailEdits } }, columns)}
                          </div>
                        ) : col.type === 'auto_increment' ? (
                          <div className="row-detail-input auto-increment-readonly">
                            <ListOrdered size={14} style={{ opacity: 0.5 }} />
                            <span>{val || '–'}</span>
                          </div>
                        ) : (
                          <div className="row-detail-input-wrapper">
                            <input
                              className={`row-detail-input ${detailErrors[colKey] ? 'invalid' : ''}`}
                              value={val}
                              ref={(el) => {
                                if (el) detailInputRefs.current.set(col.id, el);
                                else detailInputRefs.current.delete(col.id);
                              }}
                              onKeyDown={(e) => handleDetailKeyDown(e, col.id)}
                              onChange={e => {
                                setDetailEdits(prev => ({ ...prev, [colKey]: e.target.value }));
                                if (detailErrors[colKey]) setDetailErrors(prev => ({ ...prev, [colKey]: null }));
                              }}
                              placeholder={`Enter ${col.name}…`}
                              type={col.type === 'email' ? 'email' : col.type === 'phone' ? 'tel' : 'text'}
                              inputMode={col.type === 'number' || col.type === 'currency' ? 'decimal' : undefined}
                            />
                            {detailErrors[colKey] && (
                              <div className="row-detail-error-msg">
                                <AlertCircle size={10} />
                                {detailErrors[colKey]}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="row-detail-footer">
              <button className="row-detail-btn-close" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); setDetailErrors({}); }}>Cancel</button>
              <button 
                className="row-detail-btn-save" 
                disabled={isSaving}
                onClick={async () => {
                  if (!detailViewEntry) return;

                  const errors: Record<string, string | null> = {};
                  let hasErrors = false;

                  columns.forEach(col => {
                    const val = detailEdits[col.id.toString()] || '';
                    const validation = validateCellValue(col, val);
                    if (!validation.isValid) {
                      errors[col.id.toString()] = validation.error;
                      hasErrors = true;
                    }
                  });

                  // Check if we already showed these warnings
                  const hadErrorsBefore = Object.keys(detailErrors || {}).length > 0;
                  setDetailErrors(errors);

                  if (hasErrors && !hadErrorsBefore) {
                    toast("Some entries have formatting warnings. Click save again to confirm.", { icon: '⚠️' });
                    return;
                  }

                  // Batch all changes from the modal
                  const changedCells: Record<string, string> = {};
                  Object.entries(detailEdits).forEach(([colId, value]) => {
                    if (detailViewEntry.cells?.[colId] !== value) {
                      changedCells[colId] = value;
                    }
                  });

                  if (Object.keys(changedCells).length > 0) {
                    // Push to undo stack
                    const bulkChanges = Object.entries(changedCells).map(([colId, newVal]) => ({
                      columnId: colId,
                      oldValue: detailViewEntry.cells?.[colId] || '',
                      newValue: newVal
                    }));
                    pushToUndoStack({
                      type: 'BULK_EDIT_CELLS',
                      entryId: detailViewEntry.id,
                      changes: bulkChanges
                    });

                    // 1. Update local state instantly (optimistic)
                    setLocalEntries(prev => prev.map(e => 
                      e.id === detailViewEntry.id ? { ...e, cells: { ...e.cells, ...changedCells } } : e
                    ));

                    // 2. Clear any pending debounces for these specific cells
                    Object.keys(changedCells).forEach(colId => {
                      const key = `${detailViewEntry.id}-${colId}`;
                      if (debounceTimers.current[key]) {
                        clearTimeout(debounceTimers.current[key]);
                        delete debounceTimers.current[key];
                      }
                    });

                    // 3. Persist batch to Firestore (non-blocking for UI)
                    setIsSaving(true);
                    updateEntry(registerId, detailViewEntry.id, changedCells).then(() => {
                      // 4. Patch queryClient cache
                      queryClient.setQueryData(['register', registerId], (old: any) => {
                        if (!old) return old;
                        return {
                          ...old,
                          entries: old.entries.map((e: any) =>
                            e.id === detailViewEntry.id ? { ...e, cells: { ...e.cells, ...changedCells } } : e
                          ),
                        };
                      });
                      toast.success("Changes saved successfully!");
                    }).catch(err => {
                      console.error("Failed to save:", err);
                      toast.error("Failed to save changes. Please check your connection.");
                    }).finally(() => {
                      setIsSaving(false);
                    });
                  } else {
                    toast.success("No changes to save.");
                  }
                  
                  // Close modal IMMEDIATELY for instant feel
                  setDetailViewEntry(null);
                  setDetailEdits({});
                  setDetailErrors({});
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {calcMenu && (
        <div className="context-popover-layer" onClick={() => setCalcMenu(null)}>
          <div 
            className="context-menu calc-dropdown-menu"
            style={{
              position: 'fixed',
              bottom: window.innerHeight - calcMenu.rect.top + 5,
              left: Math.min(calcMenu.rect.left, window.innerWidth - 180),
              zIndex: 1000,
              width: '180px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-section-label">Calculation Type</div>
            {[
              { id: 'sum', label: 'Sum (Σ)', icon: 'Σ' },
              { id: 'count', label: 'Count (N)', icon: 'N' },
              { id: 'distinct', label: 'Distinct (D)', icon: 'D' },
              { id: 'average', label: 'Average (Avg)', icon: 'μ' },
              { id: 'min', label: 'Minimum (Min)', icon: '↓' },
              { id: 'max', label: 'Maximum (Max)', icon: '↑' },
              { id: 'filled', label: 'Filled Cells', icon: '●' },
              { id: 'empty', label: 'Empty Cells', icon: '○' },
            ].map(opt => {
              const currentType = calcTypes[calcMenu.colId] || (
                (columns.find(c => c.id === calcMenu.colId)?.type === 'number' || 
                 columns.find(c => c.id === calcMenu.colId)?.type === 'currency' || 
                 columns.find(c => c.id === calcMenu.colId)?.type === 'formula') ? 'sum' : 'count'
              );
              const isActive = currentType === opt.id;
              return (
                <button 
                  key={opt.id}
                  className={`context-item ${isActive ? 'active' : ''}`} 
                  onClick={() => updateCalcType(calcMenu.colId, opt.id)}
                >
                  <span className="context-item-icon" style={{ fontSize: '12px', width: '16px', fontWeight: 800 }}>{opt.icon}</span>
                  <span className="context-item-label" style={{ fontWeight: isActive ? 700 : 400 }}>{opt.label}</span>
                  {isActive && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>●</span>}
                </button>
              );
            })}
            
            <div className="context-divider" />
            
            <button className="context-item danger" onClick={() => updateCalcType(calcMenu.colId, 'none')}>
              <span className="context-item-label">Remove Calculation</span>
            </button>
          </div>
        </div>
      )}
      
      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <div className="img-preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="img-preview-content" onClick={e => e.stopPropagation()}>
            <div className="img-preview-header">
              <h3>Image Preview</h3>
              <div className="img-preview-actions">
                <button 
                  onClick={() => handleImageDownload(previewImage)}
                  className="img-download-btn"
                  title="Download Image"
                >
                  <Download size={18} />
                  Download
                </button>
                <button 
                  className="img-preview-close" 
                  onClick={() => setPreviewImage(null)}
                  title="Close Preview"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="img-preview-body">
              <img src={previewImage} alt="Large preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
