import { useState, useRef, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRegister, addColumn, deleteColumn, renameColumn, updateColumnDropdownOptions,
  duplicateColumn, moveColumn, reorderColumn, changeColumnType, clearColumnData, insertColumn,
  freezeColumn, hideColumn,
  addEntry, updateEntry, deleteEntry, duplicateEntry, bulkDeleteEntries,
  addPage, renamePage, deletePage,
  evaluateFormula, calculateColumnStats,
  generateShareLink, addSharedUser, removeSharedUser,
  subscribeToMutationStatus, updateEntriesOrder,
  type Entry,
} from '../lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus, MoreVertical, ChevronDown, Calendar, SortAsc, SortDesc,
  Hash, FlaskConical, Type as TypeIcon, ChevronRight, Pin, IndianRupee,
  Mail, Phone, Globe, Star, CheckSquare, Image as ImageIcon, ArrowLeft,
  Search, Filter, Eye, Trash2, FileText, Download,
} from 'lucide-react';

import { RegisterHeader } from '../components/register/RegisterHeader';
import { RegisterToolbar } from '../components/register/RegisterToolbar';
import { SpreadsheetRow } from '../components/register/SpreadsheetRow';

import { FilterModal } from '../components/register/modals/FilterModal';
import { ShareModal } from '../components/register/modals/ShareModal';
import { ColumnModals } from '../components/register/modals/ColumnModals';
import { OtherModals } from '../components/register/modals/OtherModals';
import { RegisterContextMenus } from '../components/register/menus/RegisterContextMenus';
import { COL_TYPES } from '../lib/constants';

type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max';
type SortDir = 'asc' | 'desc' | null;

export default function RegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const registerId = Number(id);
  const queryClient = useQueryClient();

  const cachedRegister = queryClient.getQueryData(['register', registerId]) as any;

  // ── State ──
  const [search, setSearch] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [localEntries, setLocalEntries] = useState<Entry[]>(cachedRegister?.entries || []);

  const [calcTypes, setCalcTypes] = useState<Record<number, CalcType>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [rowsToShow, setRowsToShow] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [newColumnModal, setNewColumnModal] = useState(false);
  const [colMenuId, setColMenuId] = useState<number | null>(null);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);
  const [renameColModal, setRenameColModal] = useState(false);
  const [dropdownConfigModal, setDropdownConfigModal] = useState(false);
  const [changeTypeModal, setChangeTypeModal] = useState(false);
  const [insertColModal, setInsertColModal] = useState<'left' | 'right' | null>(null);
  
  // Smooth column drag-and-drop reordering
  const [draggedColumnId, setDraggedColumnId] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const colHeaderRefs = useRef<Map<number, HTMLTableCellElement>>(new Map());
  const isDraggingCol = useRef(false);
  const [activeModalColId, setActiveModalColId] = useState<number | null>(null);
  const [filterModal, setFilterModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [calcModal, setCalcModal] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(new Set());
  const [detailViewEntry, setDetailViewEntry] = useState<Entry | null>(null);
  const [detailEdits, setDetailEdits] = useState<Record<string, string>>({});

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
  const [filters, setFilters] = useState<Array<{ columnId: number; operator: string; value: string; value2?: string }>>([]);
  const [activeFilters, setActiveFilters] = useState<Array<{ columnId: number; operator: string; value: string; value2?: string }>>([]);

  // Date picker for cell
  const [dateDay, setDateDay] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateYear, setDateYear] = useState('');
  const [dateEntryId, setDateEntryId] = useState<number | null>(null);
  const [dateColumnId, setDateColumnId] = useState<number | null>(null);

  // Dropdown for cell
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [dropdownEntryId, setDropdownEntryId] = useState<number | null>(null);
  const [dropdownColumnId, setDropdownColumnId] = useState<number | null>(null);

  // Share
  const [sharePhone, setSharePhone] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');

  // Rename page
  const [renamePageId, setRenamePageId] = useState<number | null>(null);
  const [renamePageValue, setRenamePageValue] = useState('');

  // Calc modal
  const [calcColId, setCalcColId] = useState<number | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Data ──
  const { data: register, isLoading } = useQuery({
    queryKey: ['register', registerId],
    queryFn: () => getRegister(registerId),
    enabled: !!registerId,
    staleTime: 5 * 60 * 1000,        // cache for 5 min — avoids re-fetch on revisit
    refetchOnWindowFocus: false,
  });

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
  const columns = useMemo(() => register?.columns || [], [register?.columns]);
  const pages = useMemo(() => register?.pages || [{ id: 1, name: 'Page 1', index: 0 }], [register?.pages]);

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
      // Auto-expand rowsToShow so all imported/loaded rows are visible immediately
      setRowsToShow((prev) => Math.max(prev, register.entries.length));
    }
  }, [register]);

  // Filter + sort entries — memoized so it only recomputes when inputs change
  const displayEntries = useMemo(() => {
    let entries = localEntries.filter((e) => (e.pageIndex || 0) === currentPageIndex);

    if (search) {
      entries = entries.filter((e) =>
        Object.values(e.cells || {}).some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      );
    }

    const parseDateString = (dStr: string) => {
      if (!dStr) return '';
      if (dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dStr;
    };

    for (const f of activeFilters) {
      entries = entries.filter((e) => {
        const val = e.cells?.[f.columnId.toString()] || '';
        const lVal = val.toLowerCase();
        const lFilter = (f.value || '').toLowerCase();

        switch (f.operator) {
          // Text
          case 'contains': return lVal.includes(lFilter);
          case 'not_contains': return !lVal.includes(lFilter);
          case 'equals': return lVal === lFilter;
          case 'not_equals': return lVal !== lFilter;
          case 'starts_with': return lVal.startsWith(lFilter);
          case 'ends_with': return lVal.endsWith(lFilter);
          // Number
          case 'eq': return parseFloat(val) === parseFloat(f.value);
          case 'gt': return parseFloat(val) > parseFloat(f.value);
          case 'gte': return parseFloat(val) >= parseFloat(f.value);
          case 'lt': return parseFloat(val) < parseFloat(f.value);
          case 'lte': return parseFloat(val) <= parseFloat(f.value);
          case 'between': {
            const n = parseFloat(val);
            return n >= parseFloat(f.value) && n <= parseFloat(f.value2 || '');
          }
          case 'not_between': {
            const n = parseFloat(val);
            return n < parseFloat(f.value) || n > parseFloat(f.value2 || '');
          }
          // Date
          case 'date_is': return parseDateString(val) === f.value;
          case 'date_not': return parseDateString(val) !== f.value;
          case 'date_before': return parseDateString(val) < f.value;
          case 'date_after': return parseDateString(val) > f.value;
          case 'date_between': {
            const dVal = parseDateString(val);
            return dVal >= f.value && dVal <= (f.value2 || '');
          }
          case 'date_not_between': {
            const dVal = parseDateString(val);
            return dVal < f.value || dVal > (f.value2 || '');
          }
          // Universal
          case 'empty': return !val;
          case 'not_empty': return !!val;
          default: return true;
        }
      });
    }

    return entries;
  }, [localEntries, currentPageIndex, search, activeFilters, columns]);

  // ── Mutations ──
  const addColumnMutation = useMutation({
    mutationFn: () => addColumn(registerId, {
      name: newColName, type: newColType,
      dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
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
          dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          formula: newColType === 'formula' ? newColFormula : undefined,
          createdAt: new Date().toISOString()
        };
        queryClient.setQueryData(['register', registerId], { ...prev, columns: [...(prev.columns || []), newCol] });
      }
      setNewColumnModal(false);
      return { prev, dummyId };
    },
    onSuccess: (newCol, _vars, context) => {
      // Replace the optimistic dummy column with the real server column
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, columns: old.columns.map((c: any) => c.id === context?.dummyId ? newCol : c) };
      });
    },
    onError: (_err, _newCol, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
    },
    onSettled: () => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(registerId, colId),
    onSuccess: (_data, colId) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, columns: old.columns.filter((c: any) => c.id !== colId) };
      });
      setColMenuId(null);
    },
  });

  const renameColumnMutation = useMutation({
    mutationFn: () => renameColumn(registerId, activeModalColId!, renameColValue),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev && activeModalColId !== null) {
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
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['register', registerId], context.prev);
      }
    },
    onSettled: () => { setRenameColValue(''); setActiveModalColId(null); },
  });

  const updateDropdownMutation = useMutation({
    mutationFn: () => updateColumnDropdownOptions(registerId, activeModalColId!, dropdownConfigOptions.split(',').map((s) => s.trim()).filter(Boolean)),
    onSuccess: (updatedCol) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, columns: old.columns.map((c: any) => c.id === updatedCol.id ? updatedCol : c) };
      });
      setDropdownConfigModal(false);
      setActiveModalColId(null);
    },
  });

  const duplicateColumnMutation = useMutation({
    mutationFn: (colId: number) => duplicateColumn(registerId, colId),
    onSuccess: (newCol, colId) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        // Also copy entries data optimistic
        const updatedEntries = old.entries.map((e: any) => {
          const val = e.cells?.[colId.toString()];
          if (val) {
             const newCells = { ...e.cells, [newCol.id.toString()]: val };
             return { ...e, cells: newCells };
          }
          return e;
        });
        return { ...old, columns: [...old.columns, newCol], entries: updatedEntries };
      });
      setColMenuId(null);
      // Ensure UI local state refreshes right away to match local cache injection
      setLocalEntries((prev) => prev.map((e) => {
         const val = e.cells?.[colId.toString()];
         if (val) return { ...e, cells: { ...e.cells, [newCol.id.toString()]: val } };
         return e;
      }));
    },
  });

  const setRowCountMutation = useMutation({
    mutationFn: async (targetCount: number) => {
      const currentCount = displayEntries.length;
      if (targetCount > currentCount) {
        const diff = targetCount - currentCount;
        for (let i = 0; i < diff; i++) {
          await addEntry(registerId, {}, currentPageIndex);
        }
      } else if (targetCount < currentCount) {
        const diff = currentCount - targetCount;
        const entriesToRemove = [...displayEntries].slice(-diff);
        await bulkDeleteEntries(registerId, entriesToRemove.map(e => e.id));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      queryClient.invalidateQueries({ queryKey: ['registers'], exact: false });
    }
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
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
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
          const [col] = cols.splice(idx, 1);
          const clampedTarget = Math.max(0, Math.min(targetIndex, cols.length));
          cols.splice(clampedTarget, 0, col);
          cols.forEach((c: any, i: number) => { c.position = i; });
          queryClient.setQueryData(['register', registerId], { ...prev, columns: cols });
        }
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
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

  const handleColDragMouseDown = useCallback((e: React.MouseEvent, colId: number) => {
    // Only left mouse button; ignore if clicking the three-dot menu button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.col-menu-btn')) return;

    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement;
    if (!th) return;

    // If click is near the right edge of the header inner, let the native CSS resize handle work
    const headerInner = th.querySelector('.col-header-inner') as HTMLElement | null;
    if (headerInner) {
      const innerRect = headerInner.getBoundingClientRect();
      const distFromRight = innerRect.right - e.clientX;
      if (distFromRight >= 0 && distFromRight <= 16) return; // resize zone — bail out
    }

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

  const changeColumnTypeMutation = useMutation({
    mutationFn: () => changeColumnType(registerId, activeModalColId!, changeTypeValue),
    onSuccess: (updatedCol) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, columns: old.columns.map((c: any) => c.id === updatedCol.id ? updatedCol : c) };
      });
      setChangeTypeModal(false); setActiveModalColId(null);
    },
  });

  const clearColumnDataMutation = useMutation({
    mutationFn: (colId: number) => clearColumnData(registerId, colId),
    onSuccess: (_data, colId) => {
      const colIdStr = colId.toString();
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          entries: old.entries.map((e: any) => {
            const cells = { ...e.cells };
            delete cells[colIdStr];
            return { ...e, cells };
          }),
        };
      });
      setLocalEntries(prev => prev.map(e => { const cells = { ...e.cells }; delete cells[colIdStr]; return { ...e, cells }; }));
      setColMenuId(null);
    },
  });

  const insertColumnMutation = useMutation({
    mutationFn: () => {
      const col = columns.find((c) => c.id === activeModalColId);
      const pos = col ? (insertColModal === 'left' ? col.position : col.position + 1) : columns.length;
      return insertColumn(registerId, {
        name: newColName, type: newColType,
        dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        formula: newColType === 'formula' ? newColFormula : undefined,
      }, pos);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const colNode = prev.columns?.find((c: any) => c.id === activeModalColId);
        const pos = colNode ? (insertColModal === 'left' ? colNode.position : colNode.position + 1) : (prev.columns?.length || 0);
        
        const newCol = {
          id: Date.now(),
          registerId,
          name: newColName,
          type: newColType,
          position: pos,
          dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
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
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
    },
    onSuccess: (newCol, _vars, context) => {
      // Replace the optimistic dummy column with the real server column
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, columns: old.columns.map((c: any) => c.id === (context as any)?.dummyId ? newCol : c) };
      });
    },
    onSettled: () => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); },
  });

  const addEntryMutation = useMutation({
    mutationFn: () => addEntry(registerId, {}, currentPageIndex),
    onMutate: async () => {
      // Optimistic: add a temporary row instantly
      const tempEntry: Entry = {
        id: Date.now(),
        registerId,
        rowNumber: localEntries.length + 1,
        cells: {},
        createdAt: new Date().toISOString(),
        pageIndex: currentPageIndex,
      };
      setLocalEntries((prev) => [...prev, tempEntry]);
      setRowsToShow((prev) => Math.max(prev, localEntries.length + 1));
      return { tempId: tempEntry.id };
    },
    onSuccess: (newEntry, _vars, context) => {
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

  // ── Handlers ──
  const handleCellChange = useCallback((entryId: number, columnId: string, value: string) => {
    // 1. Update local state instantly (optimistic)
    setLocalEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, cells: { ...e.cells, [columnId]: value } } : e));

    // 2. Debounce the Firestore write — no invalidateQueries, just patch the cache
    const key = `${entryId}-${columnId}`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
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
  }, [registerId, queryClient]);

  // Excel-like sort: permanently reorders localEntries and persists to Firestore
  const handleSort = useCallback((colId: number, direction: 'asc' | 'desc') => {
    const parseDateString = (dStr: string) => {
      if (!dStr) return '';
      if (dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dStr;
    };

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

  const openDatePicker = useCallback((entryId: number, colId: number, currentVal: string) => {
    const parts = currentVal?.split('/') || [];
    setDateDay(parts[0] || ''); setDateMonth(parts[1] || ''); setDateYear(parts[2] || '');
    setDateEntryId(entryId); setDateColumnId(colId); setDateModal(true);
  }, []);

  const handleDateSelect = () => {
    const dateStr = `${dateDay.padStart(2, '0')}/${dateMonth.padStart(2, '0')}/${dateYear}`;
    if (dateEntryId != null && dateColumnId != null) handleCellChange(dateEntryId, dateColumnId.toString(), dateStr);
    setDateModal(false);
  };

  const openDropdown = useCallback((entryId: number, colId: number, options: string[]) => {
    setDropdownEntryId(entryId); setDropdownColumnId(colId); setDropdownOptions(options);
    setDropdownModal(true);
  }, []);

  const handleExportExcel = () => {
    if (!register) return;

    const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.id));
    const headerRow = visibleColumns.map(c => c.name);

    if (headerRow.length === 0) return;
    
    const rows = displayEntries.map(entry => {
      const rowObj: Record<string, string> = {};
      visibleColumns.forEach(c => {
         const cellValue = c.type === 'formula' ? evaluateFormula(c.formula || '', entry, columns) : (entry.cells?.[c.id.toString()] || '');
         rowObj[c.name] = cellValue;
      });
      return rowObj;
    });

    try {
      const ws = XLSX.utils.json_to_sheet(rows, { header: headerRow });
      
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
        const colLetter = getColLetter(cIdx);

        if (c.type === 'dropdown' && c.dropdownOptions && c.dropdownOptions.length > 0) {
          ws['!dataValidation'].push({
            sqref: `${colLetter}2:${colLetter}1000`,
            type: 'list',
            allowBlank: true,
            showDropDown: true,
            formula1: `"${c.dropdownOptions.join(',')}"`
          });
        }

        if (c.type === 'formula' && c.formula) {
          rows.forEach((row, rIdx) => {
            let excelF = c.formula || '';
            visibleColumns.forEach((col, refIdx) => {
              const refLetter = getColLetter(refIdx);
              excelF = excelF.replace(new RegExp(`\\{${col.name}\\}`, 'g'), `${refLetter}${rIdx + 2}`);
            });
            const cellRef = `${colLetter}${rIdx + 2}`;
            ws[cellRef] = { t: 'n', f: excelF, v: row[c.name] === 'ERR' ? '' : row[c.name] };
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

    const visibleCols = columns.filter((col) => !hiddenColumns.has(col.id));
    const headerRow = visibleCols.map(c => c.name);
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

      autoTable(doc, {
        startY: 30,
        head: [['S.No.', ...headerRow]],
        body: bodyRows,
        theme: 'grid',
        headStyles: {
          fillColor: [20, 83, 45],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.25,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
        },
        margin: { left: 14, right: 14 },
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
    const visibleCols = columns.filter(col => !hiddenColumns.has(col.id));
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

      const bodyRows = visibleCols.map(c => {
        const val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');
        return [c.name, val];
      });

      autoTable(doc, {
        startY: 30,
        head: [['Field', 'Value']],
        body: bodyRows,
        theme: 'grid',
        headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.25 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
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
    const visibleCols = columns.filter(col => !hiddenColumns.has(col.id));
    const rowIdx = localEntries.indexOf(entry) + 1;

    try {
      const headerRow = visibleCols.map(c => c.name);
      const rowObj: Record<string, string> = {};
      visibleCols.forEach(c => {
        const val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');
        rowObj[c.name] = val;
      });

      const ws = XLSX.utils.json_to_sheet([rowObj], { header: headerRow });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
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
    const visibleCols = columns.filter(col => !hiddenColumns.has(col.id));

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

  const visibleColumns = useMemo(() => columns.filter((col) => !hiddenColumns.has(col.id)), [columns, hiddenColumns]);

  // Keep refs in sync for smooth drag handler closures
  visibleColumnsRef.current = visibleColumns;
  columnsRef.current = columns;

  // Defer formula/stats recalculation so it doesn't block keystrokes (Fix #3)
  const deferredDisplayEntries = useDeferredValue(displayEntries);

  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    // Delay stats calculation to ensure the UI paints immediately when jumping between registers.
    const timer = setTimeout(() => setStatsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const allStats = useMemo(() => {
    const statsMap: Record<number, any> = {};
    if (!statsReady) return statsMap;

    visibleColumns.forEach(col => {
      if (col.type === 'number' || col.type === 'formula') {
        const colIdStr = col.id.toString();
        let entriesToStat = deferredDisplayEntries;
        if (col.type === 'formula' && col.formula) {
           entriesToStat = deferredDisplayEntries.map(e => ({
             ...e,
             cells: { ...e.cells, [colIdStr]: evaluateFormula(col.formula!, e, columns) }
           }));
        }
        statsMap[col.id] = calculateColumnStats(entriesToStat, colIdStr);
      }
    });
    return statsMap;
  }, [deferredDisplayEntries, visibleColumns, columns, statsReady]);

  const getCalcValue = (colId: number): string => {
    const type = calcTypes[colId] || 'sum';
    const stats = allStats[colId];
    if (!stats) return '-';
    switch (type) {
      case 'sum': return stats.sum.toFixed(2);
      case 'average': return stats.average.toFixed(2);
      case 'count': return stats.count.toString();
      case 'min': return stats.min.toFixed(2);
      case 'max': return stats.max.toFixed(2);
      default: return '-';
    }
  };

  const visibleEntries = useMemo(() => displayEntries.slice(0, rowsToShow), [displayEntries, rowsToShow]);

  if (isLoading) return (
    <div className="content-area">
      <div className="center-loader">
        <div className="spinner dark spinner-large" />
        <span className="center-loader-text">Loading register…</span>
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
            </button>
          ))}
          <button className="page-add-btn" onClick={() => addPageMutation.mutate()}>
            <Plus size={12} /> Add Page
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

          {/* Expandable search */}
          <div className={`pab-search${search ? ' open' : ''}`} id="pab-search-wrap">
            <input
              id="pab-search-input"
              className="pab-search-input"
              placeholder="Search rows…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
            />
            <button
              className={`pab-icon-btn${search ? ' active' : ''}`}
              title="Search" aria-label="Search rows"
              onClick={() => { (document.getElementById('pab-search-input') as HTMLInputElement)?.focus(); }}
            >
              <Search size={13} />
            </button>
          </div>

          {/* Filter */}
          <button
            className={`pab-icon-btn${activeFilters.length > 0 ? ' active' : ''}`}
            title={`Filter${activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}`}
            onClick={() => { setFilters(activeFilters.length ? [...activeFilters] : []); setFilterModal(true); }}
            aria-label="Filter"
          >
            <Filter size={13} />
            {activeFilters.length > 0 && <span className="pab-badge">{activeFilters.length}</span>}
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



      {/* ── Guidance Banner ── */}
      {displayEntries.length === 0 && columns.length > 0 && (
        <div className="guidance-banner" onClick={() => addEntryMutation.mutate()}>
          <div className="guidance-icon"><Plus size={20} /></div>
          <div>
            <div className="guidance-title">Ready to enter data!</div>
            <div className="guidance-sub">Click to add your first row</div>
          </div>
          <div className="guidance-add"><ChevronRight size={18} /></div>
        </div>
      )}

      {/* ── Spreadsheet ── */}
      <div className="spreadsheet-wrapper">
        <table className="spreadsheet">
          <thead>
            <tr>
              <th className="serial">S.No.</th>
              {visibleColumns.map((col) => {
                const IconComponent = (() => {
                  const nameL = (col.name || '').toLowerCase();
                  const isPayment = nameL.includes('amount') || nameL.includes('fee') || nameL.includes('payment') || nameL.includes('balance') || nameL.includes('price');
                  if (isPayment) return <IndianRupee size={12} />;
                  switch (col.type) {
                    case 'number':   return <Hash size={12} />;
                    case 'date':     return <Calendar size={12} />;
                    case 'dropdown': return <ChevronDown size={12} />;
                    case 'formula':  return <FlaskConical size={12} />;
                    case 'phone':    return <Phone size={12} />;
                    case 'email':    return <Mail size={12} />;
                    case 'url':      return <Globe size={12} />;
                    case 'rating':   return <Star size={12} />;
                    case 'checkbox': return <CheckSquare size={12} />;
                    case 'image':    return <ImageIcon size={12} />;
                    default:         return <TypeIcon size={12} />;
                  }
                })();

                return (
                <th 
                  key={col.id} 
                  className={`col-header-cell ${draggedColumnId === col.id ? 'dragging' : ''}`}
                  ref={(el) => {
                    if (el) colHeaderRefs.current.set(col.id, el);
                    else colHeaderRefs.current.delete(col.id);
                  }}
                  onMouseDown={(e) => handleColDragMouseDown(e, col.id)}
                >
                  <div className="col-header-inner">
                    {IconComponent}
                    <span>{col.name}</span>
                    {frozenColumns.has(col.id) && <Pin size={10} color="var(--muted)" className="frozen-pin" />}
                    <button
                      className="col-menu-btn"
                      aria-label="Column Options"
                      title="Column Options"
                      onClick={(e) => { e.stopPropagation(); setColMenuId(colMenuId === col.id ? null : col.id); }}
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </th>
              )})}
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry, idx) => (
              <SpreadsheetRow 
                key={entry.id}
                entry={entry}
                idx={idx}
                visibleColumns={visibleColumns}
                isSelected={selectedRows.has(entry.id)}
                toggleSelectRow={toggleSelectRow}
                handleCellChange={handleCellChange}
                openDatePicker={openDatePicker}
                openDropdown={openDropdown}
                isMenuOpen={rowMenuId === entry.id}
                toggleMenu={toggleMenu}
                registerColumns={columns}
                onRowDoubleClick={setDetailViewEntry}
              />
            ))}

            {displayEntries.length > rowsToShow && (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="load-more-container">
                  <button className="load-more-btn" onClick={() => setRowsToShow(prev => prev + 100)}>
                    Load More Rows ({displayEntries.length - rowsToShow} remaining)
                  </button>
                </td>
              </tr>
            )}

            {/* Mock rows for empty template registers */}
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
        </table>
      </div>

      {/* ── Calc Bar ── */}
      {visibleColumns.some((c) => c.type === 'number' || c.type === 'formula') && displayEntries.length > 0 && (
        <div className="calc-bar">
          <div className="calc-cell calc-cell-sm" />
          <div className="calc-cell calc-cell-md">
            <span className="calc-label">Σ</span>
          </div>
          {visibleColumns.map((col) => (
            <div
              key={col.id}
              className="calc-cell calc-cell-flex"
              onClick={() => {
                if (col.type === 'number' || col.type === 'formula') {
                  setCalcColId(col.id);
                  setCalcModal(true);
                }
              }}
            >
              {(col.type === 'number' || col.type === 'formula') ? (
                <><span className="calc-label">{(calcTypes[col.id] || 'sum').toUpperCase()}:</span> {getCalcValue(col.id)}</>
              ) : ''}
            </div>
          ))}
          <div className="calc-cell calc-cell-lg" />
        </div>
      )}

      {/* ── Context Menus ── */}
      <RegisterContextMenus 
        colMenuId={colMenuId} setColMenuId={setColMenuId} columns={columns}
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
        COL_TYPES={COL_TYPES}
      />

      <FilterModal 
        filterModal={filterModal} setFilterModal={setFilterModal}
        filters={filters} setFilters={setFilters} setActiveFilters={setActiveFilters}
        columns={columns}
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
        handleDateSelect={handleDateSelect}
        dropdownModal={dropdownModal} setDropdownModal={setDropdownModal}
        dropdownOptions={dropdownOptions} dropdownEntryId={dropdownEntryId} dropdownColumnId={dropdownColumnId}
        localEntries={localEntries} handleCellChange={handleCellChange}
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
              {columns.filter(col => col.type !== 'formula').map(col => {
                const colKey = col.id.toString();
                const val = detailEdits[colKey] ?? '';
                return (
                  <div className="row-detail-field" key={col.id}>
                    <label className="row-detail-label">{col.name}</label>
                    <input
                      className="row-detail-input"
                      value={val}
                      onChange={e => setDetailEdits(prev => ({ ...prev, [colKey]: e.target.value }))}
                      placeholder={`Enter ${col.name}…`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="row-detail-footer">
              <button className="row-detail-btn-close" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); }}>Cancel</button>
              <button className="row-detail-btn-save" onClick={() => {
                // Save all edited fields
                Object.entries(detailEdits).forEach(([colId, value]) => {
                  handleCellChange(detailViewEntry.id, colId, value);
                });
                setDetailViewEntry(null);
                setDetailEdits({});
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
