import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRegister, addColumn, deleteColumn, renameColumn, updateColumnDropdownOptions,
  duplicateColumn, moveColumn, changeColumnType, clearColumnData, insertColumn,
  freezeColumn, hideColumn,
  addEntry, updateEntry, deleteEntry, duplicateEntry, bulkDeleteEntries,
  addPage, renamePage, deletePage,
  evaluateFormula, calculateColumnStats,
  generateShareLink, addSharedUser, removeSharedUser,
  type Entry,
} from '../lib/api';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, Plus, Search, Filter, Download, Share2, MoreVertical,
  Pencil, Trash2, Copy, ChevronDown, Calendar, X, Check, SortAsc, SortDesc,
  Hash, FlaskConical, Type as TypeIcon, AlertCircle, FileText, UserX,
  ChevronRight, Link2, UserPlus, ArrowLeftRight, ArrowRight, ChevronsLeftRight,
  Pin, EyeOff, Eye, Eraser,
} from 'lucide-react';

type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max';
type SortDir = 'asc' | 'desc' | null;

const COL_TYPES = [
  { id: 'text', label: 'Text', icon: <TypeIcon size={12} /> },
  { id: 'number', label: 'Number', icon: <Hash size={12} /> },
  { id: 'date', label: 'Date', icon: <Calendar size={12} /> },
  { id: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={12} /> },
  { id: 'formula', label: 'Formula', icon: <FlaskConical size={12} /> },
];

export default function RegisterPage() {
  const { id } = useParams();
  const registerId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── State ──
  const [search, setSearch] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [localEntries, setLocalEntries] = useState<Entry[]>([]);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [calcTypes, setCalcTypes] = useState<Record<number, CalcType>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Modals
  const [newColumnModal, setNewColumnModal] = useState(false);
  const [colMenuId, setColMenuId] = useState<number | null>(null);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);
  const [renameColModal, setRenameColModal] = useState(false);
  const [dropdownConfigModal, setDropdownConfigModal] = useState(false);
  const [changeTypeModal, setChangeTypeModal] = useState(false);
  const [insertColModal, setInsertColModal] = useState<'left' | 'right' | null>(null);
  const [filterModal, setFilterModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [calcModal, setCalcModal] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(new Set());

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
  const [filters, setFilters] = useState<Array<{ columnId: number; operator: string; value: string }>>([]);
  const [activeFilters, setActiveFilters] = useState<Array<{ columnId: number; operator: string; value: string }>>([]);

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
  });

  useEffect(() => {
    if (register) setLocalEntries(register.entries);
  }, [register]);

  const columns = register?.columns || [];
  const pages = register?.pages || [{ id: 1, name: 'Page 1', index: 0 }];

  // Filter + sort entries
  const getDisplayEntries = useCallback(() => {
    let entries = localEntries.filter((e) => (e.pageIndex || 0) === currentPageIndex);

    // Search
    if (search) {
      entries = entries.filter((e) =>
        Object.values(e.cells || {}).some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Active filters
    for (const f of activeFilters) {
      entries = entries.filter((e) => {
        const val = e.cells?.[f.columnId.toString()] || '';
        switch (f.operator) {
          case 'contains': return val.toLowerCase().includes(f.value.toLowerCase());
          case 'equals': return val.toLowerCase() === f.value.toLowerCase();
          case 'gt': return parseFloat(val) > parseFloat(f.value);
          case 'lt': return parseFloat(val) < parseFloat(f.value);
          case 'empty': return !val;
          case 'not_empty': return !!val;
          default: return true;
        }
      });
    }

    // Sort
    if (sortCol !== null && sortDir) {
      entries = [...entries].sort((a, b) => {
        const aVal = a.cells?.[sortCol.toString()] || '';
        const bVal = b.cells?.[sortCol.toString()] || '';
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return entries;
  }, [localEntries, currentPageIndex, search, activeFilters, sortCol, sortDir]);

  const displayEntries = getDisplayEntries();

  // ── Mutations ──
  const addColumnMutation = useMutation({
    mutationFn: () => addColumn(registerId, {
      name: newColName, type: newColType,
      dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      formula: newColType === 'formula' ? newColFormula : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setNewColumnModal(false); setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(registerId, colId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setColMenuId(null); },
  });

  const renameColumnMutation = useMutation({
    mutationFn: () => renameColumn(registerId, colMenuId!, renameColValue),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setRenameColModal(false); },
  });

  const updateDropdownMutation = useMutation({
    mutationFn: () => updateColumnDropdownOptions(registerId, colMenuId!, dropdownConfigOptions.split(',').map((s) => s.trim()).filter(Boolean)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setDropdownConfigModal(false); },
  });

  const duplicateColumnMutation = useMutation({
    mutationFn: (colId: number) => duplicateColumn(registerId, colId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setColMenuId(null); },
  });

  const moveColumnMutation = useMutation({
    mutationFn: ({ colId, dir }: { colId: number; dir: 'left' | 'right' }) => moveColumn(registerId, colId, dir),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setColMenuId(null); },
  });

  const changeColumnTypeMutation = useMutation({
    mutationFn: () => changeColumnType(registerId, colMenuId!, changeTypeValue),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setChangeTypeModal(false); setColMenuId(null); },
  });

  const clearColumnDataMutation = useMutation({
    mutationFn: (colId: number) => clearColumnData(registerId, colId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setColMenuId(null); },
  });

  const insertColumnMutation = useMutation({
    mutationFn: () => {
      const col = columns.find((c) => c.id === colMenuId);
      const pos = col ? (insertColModal === 'left' ? col.position : col.position + 1) : columns.length;
      return insertColumn(registerId, {
        name: newColName, type: newColType,
        dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        formula: newColType === 'formula' ? newColFormula : undefined,
      }, pos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setInsertColModal(null); setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
      setColMenuId(null);
    },
  });

  const addEntryMutation = useMutation({
    mutationFn: () => addEntry(registerId, {}, currentPageIndex),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['register', registerId] }),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => deleteEntry(registerId, entryId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setRowMenuId(null); },
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: (entryId: number) => duplicateEntry(registerId, entryId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setRowMenuId(null); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => bulkDeleteEntries(registerId, Array.from(selectedRows)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setSelectedRows(new Set()); },
  });

  const addPageMutation = useMutation({
    mutationFn: () => addPage(registerId),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setCurrentPageIndex(newPage.index);
    },
  });

  const renamePageMutation = useMutation({
    mutationFn: () => renamePage(registerId, renamePageId!, renamePageValue),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setRenamePageModal(false); },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => deletePage(registerId, pageId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setCurrentPageIndex(0); },
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
    setLocalEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, cells: { ...e.cells, [columnId]: value } } : e));
    const key = `${entryId}-${columnId}`;
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      updateEntry(registerId, entryId, { [columnId]: value });
    }, 500);
  }, [registerId]);

  const handleSort = (colId: number) => {
    if (sortCol === colId) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  const openDatePicker = (entryId: number, colId: number, currentVal: string) => {
    const parts = currentVal?.split('/') || [];
    setDateDay(parts[0] || ''); setDateMonth(parts[1] || ''); setDateYear(parts[2] || '');
    setDateEntryId(entryId); setDateColumnId(colId); setDateModal(true);
  };

  const handleDateSelect = () => {
    const dateStr = `${dateDay.padStart(2, '0')}/${dateMonth.padStart(2, '0')}/${dateYear}`;
    if (dateEntryId && dateColumnId) handleCellChange(dateEntryId, dateColumnId.toString(), dateStr);
    setDateModal(false);
  };

  const openDropdown = (entryId: number, colId: number, options: string[]) => {
    setDropdownEntryId(entryId); setDropdownColumnId(colId); setDropdownOptions(options);
    setDropdownModal(true);
  };

  const handleExportExcel = () => {
    if (!register) return;

    const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.id));
    const headerRow = visibleColumns.map(c => c.name);

    if (headerRow.length === 0) return;
    
    // Build rows from entries based on visibleColumns and evaluating formulas
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
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${register.name || 'Export'}.xlsx`);
    } catch (err) {
      console.error("Export Error: ", err);
      alert("Failed to export Excel file.");
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === displayEntries.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(displayEntries.map((e) => e.id)));
  };

  const toggleSelectRow = (id: number) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedRows(newSet);
  };

  const getCalcValue = (colId: number): string => {
    const type = calcTypes[colId] || 'sum';
    const stats = calculateColumnStats(displayEntries, colId.toString());
    switch (type) {
      case 'sum': return stats.sum.toFixed(2);
      case 'average': return stats.average.toFixed(2);
      case 'count': return stats.count.toString();
      case 'min': return stats.min.toFixed(2);
      case 'max': return stats.max.toFixed(2);
      default: return '-';
    }
  };

  if (isLoading) return (
    <div className="center-loader">
      <div className="spinner dark spinner-large" />
    </div>
  );
  if (!register) return <div className="empty-state"><p>Register not found</p></div>;

  const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.id));

  return (
    <div className="register-layout">
      {/* ── Header ── */}
      <div className="register-header">
        <button className="register-header-btn" aria-label="Go Back" title="Go Back" onClick={() => navigate('/')}>
          <ArrowLeft size={14} />
        </button>
        <h1 className="register-header-title">{register.name}</h1>
        <button className="register-header-btn" onClick={() => setShareModal(true)}>
          <Share2 size={14} /> Share
        </button>
        <button className="register-header-btn" onClick={handleExportExcel}>
          <Download size={14} /> Export (Excel)
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="register-toolbar">
        <div className="toolbar-search">
          <Search size={14} color="var(--muted)" />
          <input placeholder="Search rows..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="toolbar-btn" onClick={() => { setFilters(activeFilters.length ? [...activeFilters] : []); setFilterModal(true); }}>
          <Filter size={13} /> Filter {activeFilters.length > 0 ? `(${activeFilters.length})` : ''}
        </button>
        <button className="toolbar-btn primary" onClick={() => addEntryMutation.mutate()}>
          <Plus size={13} /> Add Row
        </button>
        <button className="toolbar-btn" onClick={() => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); setNewColumnModal(true); }}>
          <Plus size={13} /> Add Column
        </button>
        {hiddenColumns.size > 0 && (
          <button className="hidden-cols-btn" onClick={() => {
            setHiddenColumns(new Set());
            hiddenColumns.forEach((colId) => hideColumn(registerId, colId, false));
          }}>
            <Eye size={13} /> Show {hiddenColumns.size} Hidden
          </button>
        )}
        {selectedRows.size > 0 && (
          <button className="toolbar-btn danger" onClick={() => { if (confirm(`Delete ${selectedRows.size} selected rows?`)) bulkDeleteMutation.mutate(); }}>
            <Trash2 size={13} /> Delete ({selectedRows.size})
          </button>
        )}
        <div className="toolbar-stats">
          <span className="toolbar-stat"><Hash size={12} />{displayEntries.length} rows</span>
          <span className="toolbar-stat"><FileText size={12} />{columns.length} cols</span>
        </div>
      </div>

      {/* ── Pages Bar ── */}
      {pages.length > 0 && (
        <div className="pages-bar">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              className={`page-tab ${idx === currentPageIndex ? 'active' : ''}`}
              onClick={() => setCurrentPageIndex(idx)}
              onDoubleClick={() => { setRenamePageId(page.id); setRenamePageValue(page.name); setRenamePageModal(true); }}
            >
              {page.name}
            </button>
          ))}
          <button className="page-add-btn" onClick={() => addPageMutation.mutate()}>
            <Plus size={12} /> Add Page
          </button>
        </div>
      )}

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
              <th className="serial serial-header-checkbox">
                <input type="checkbox" title="Select All" aria-label="Select All" checked={selectedRows.size === displayEntries.length && displayEntries.length > 0} onChange={toggleSelectAll} />
              </th>
              <th className="serial">S.No.</th>
              {visibleColumns.map((col) => (
                <th key={col.id} onClick={() => handleSort(col.id)} className="col-header-cell">
                  <div className="col-header-inner">
                    {col.type === 'number' ? <Hash size={12} /> : col.type === 'date' ? <Calendar size={12} /> : col.type === 'dropdown' ? <ChevronDown size={12} /> : col.type === 'formula' ? <FlaskConical size={12} /> : <TypeIcon size={12} />}
                    <span>{col.name}</span>
                    {sortCol === col.id && (sortDir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                    {frozenColumns.has(col.id) && <Pin size={10} color="var(--muted)" className="frozen-pin" />}
                    <button
                      className="col-menu-btn"
                      aria-label="Column Options"
                      title="Column Options"
                      onClick={(e) => { e.stopPropagation(); setColMenuId(colMenuId === col.id ? null : col.id); }}
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {displayEntries.map((entry, idx) => (
              <tr key={entry.id}>
                <td className="serial">
                  <input type="checkbox" title="Select Row" aria-label="Select Row" checked={selectedRows.has(entry.id)} onChange={() => toggleSelectRow(entry.id)} />
                </td>
                <td className="serial">{idx + 1}</td>
                {visibleColumns.map((col) => (
                  <td key={col.id}>
                    {col.type === 'formula' ? (
                      <div className={`cell-formula ${evaluateFormula(col.formula || '', entry, columns) === 'ERR' ? 'error' : ''}`}>
                        {evaluateFormula(col.formula || '', entry, columns) || '–'}
                      </div>
                    ) : col.type === 'date' ? (
                      <div className="cell-date" onClick={() => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '')}>
                        {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><Calendar size={12} /> Select date</span>}
                      </div>
                    ) : col.type === 'dropdown' ? (
                      <div className="cell-dropdown" onClick={() => openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'])}>
                        {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><ChevronDown size={12} /> Select</span>}
                      </div>
                    ) : (
                      <input
                        className="cell-input"
                        value={entry.cells?.[col.id.toString()] || ''}
                        onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)}
                        type={col.type === 'number' ? 'number' : 'text'}
                        placeholder={col.name}
                      />
                    )}
                  </td>
                ))}
                <td className="actions">
                  <button className="row-menu-btn" aria-label="Row Options" title="Row Options" onClick={() => setRowMenuId(rowMenuId === entry.id ? null : entry.id)}>
                    <MoreVertical size={14} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Mock rows for empty template registers */}
            {displayEntries.length === 0 && columns.length > 0 && [1, 2, 3].map((n) => (
              <tr key={`mock-${n}`} className="mock" onClick={() => addEntryMutation.mutate()}>
                <td className="serial" />
                <td className="serial">{n}</td>
                {visibleColumns.map((col) => (
                  <td key={col.id}><div className="mock-cell-content">{col.name}...</div></td>
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

      {/* ═══════════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════════ */}

      {/* ── Add Column ── */}
      {newColumnModal && (
        <div className="modal-overlay" onClick={() => setNewColumnModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add New Column</h3>
            <label className="modal-label">Column Name</label>
            <input className="modal-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="e.g. Amount" autoFocus />
            <label className="modal-label">Column Type</label>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${newColType === t.id ? 'active' : ''}`} onClick={() => setNewColType(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {newColType === 'dropdown' && (
              <>
                <label className="modal-label">Options (comma-separated)</label>
                <input className="modal-input" value={newColDropdownOpts} onChange={(e) => setNewColDropdownOpts(e.target.value)} placeholder="e.g. Active, Inactive, Pending" />
              </>
            )}
            {newColType === 'formula' && (
              <>
                <label className="modal-label">Formula</label>
                <input className="modal-input" value={newColFormula} onChange={(e) => setNewColFormula(e.target.value)} placeholder="e.g. {Marks}/{Full Marks}*100" />
                <div className="formula-hint">
                  <AlertCircle size={14} color="var(--muted)" />
                  <span className="formula-hint-text">Use {'{Column Name}'} to reference other columns. Supports +, -, *, /</span>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setNewColumnModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!newColName.trim()} onClick={() => addColumnMutation.mutate()}>
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Column Context Menu (full Record Book options) ── */}
      {colMenuId !== null && (
        <div className="modal-overlay" onClick={() => setColMenuId(null)}>
          <div className="context-menu context-menu-wide" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">
              {columns.find((c) => c.id === colMenuId)?.type === 'number' ? <Hash size={14} /> :
               columns.find((c) => c.id === colMenuId)?.type === 'date' ? <Calendar size={14} /> :
               columns.find((c) => c.id === colMenuId)?.type === 'dropdown' ? <ChevronDown size={14} /> :
               columns.find((c) => c.id === colMenuId)?.type === 'formula' ? <FlaskConical size={14} /> :
               <TypeIcon size={14} />}
              {columns.find((c) => c.id === colMenuId)?.name || 'Column'}
              <span className="context-type-badge">{columns.find((c) => c.id === colMenuId)?.type}</span>
            </div>

            {/* ── Sort ── */}
            <div className="context-section-label">Sort</div>
            <button className="context-item" onClick={() => {
              setSortCol(colMenuId); setSortDir('asc'); setColMenuId(null);
            }}>
              <SortAsc size={16} /> Sort A → Z
              {sortCol === colMenuId && sortDir === 'asc' && <Check size={14} className="context-check" />}
            </button>
            <button className="context-item" onClick={() => {
              setSortCol(colMenuId); setSortDir('desc'); setColMenuId(null);
            }}>
              <SortDesc size={16} /> Sort Z → A
              {sortCol === colMenuId && sortDir === 'desc' && <Check size={14} className="context-check" />}
            </button>

            <div className="context-divider" />

            {/* ── Edit ── */}
            <div className="context-section-label">Edit</div>
            <button className="context-item" onClick={() => {
              setRenameColValue(columns.find((c) => c.id === colMenuId)?.name || '');
              setRenameColModal(true);
            }}>
              <Pencil size={16} /> Rename Column
            </button>
            <button className="context-item" onClick={() => {
              setChangeTypeValue(columns.find((c) => c.id === colMenuId)?.type || 'text');
              setChangeTypeModal(true);
            }}>
              <ArrowLeftRight size={16} /> Change Column Type
            </button>
            {columns.find((c) => c.id === colMenuId)?.type === 'dropdown' && (
              <button className="context-item" onClick={() => {
                const col = columns.find((c) => c.id === colMenuId);
                setDropdownConfigOptions(col?.dropdownOptions?.join(', ') || '');
                setDropdownConfigModal(true);
              }}>
                <ChevronDown size={16} /> Edit Dropdown Options
              </button>
            )}

            <div className="context-divider" />

            {/* ── Insert & Duplicate ── */}
            <div className="context-section-label">Insert & Copy</div>
            <button className="context-item" onClick={() => duplicateColumnMutation.mutate(colMenuId)}>
              <Copy size={16} /> Duplicate Column
            </button>
            <button className="context-item" onClick={() => {
              setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
              setInsertColModal('left');
            }}>
              <Plus size={16} /> Insert Column Left
            </button>
            <button className="context-item" onClick={() => {
              setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
              setInsertColModal('right');
            }}>
              <ArrowRight size={16} /> Insert Column Right
            </button>

            <div className="context-divider" />

            {/* ── Arrange ── */}
            <div className="context-section-label">Arrange</div>
            <button className="context-item"
              disabled={columns.findIndex((c) => c.id === colMenuId) === 0}
              onClick={() => moveColumnMutation.mutate({ colId: colMenuId, dir: 'left' })}
            >
              <ChevronsLeftRight size={16} /> Move Left
            </button>
            <button className="context-item"
              disabled={columns.findIndex((c) => c.id === colMenuId) === columns.length - 1}
              onClick={() => moveColumnMutation.mutate({ colId: colMenuId, dir: 'right' })}
            >
              <ChevronsLeftRight size={16} /> Move Right
            </button>
            <button className="context-item" onClick={() => {
              const newFrozen = new Set(frozenColumns);
              if (newFrozen.has(colMenuId)) newFrozen.delete(colMenuId);
              else newFrozen.add(colMenuId);
              setFrozenColumns(newFrozen);
              freezeColumn(registerId, colMenuId, !frozenColumns.has(colMenuId));
              setColMenuId(null);
            }}>
              <Pin size={16} /> {frozenColumns.has(colMenuId) ? 'Unfreeze Column' : 'Freeze / Pin Column'}
            </button>
            <button className="context-item" onClick={() => {
              const newHidden = new Set(hiddenColumns);
              newHidden.add(colMenuId);
              setHiddenColumns(newHidden);
              hideColumn(registerId, colMenuId, true);
              setColMenuId(null);
            }}>
              <EyeOff size={16} /> Hide Column
            </button>

            <div className="context-divider" />

            {/* ── Destructive ── */}
            <button className="context-item danger" onClick={() => {
              if (confirm('Clear all data in this column? This cannot be undone.')) clearColumnDataMutation.mutate(colMenuId);
            }}>
              <Eraser size={16} /> Clear Column Data
            </button>
            <button className="context-item danger" onClick={() => {
              if (confirm('Delete this column and all its data?')) deleteColumnMutation.mutate(colMenuId);
            }}>
              <Trash2 size={16} /> Delete Column
            </button>
          </div>
        </div>
      )}

      {/* ── Row Context Menu ── */}
      {rowMenuId !== null && (
        <div className="modal-overlay" onClick={() => setRowMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">Row Actions</div>
            <button className="context-item" onClick={() => duplicateEntryMutation.mutate(rowMenuId)}>
              <Copy size={16} /> Duplicate Row
            </button>
            <button className="context-item danger" onClick={() => {
              if (confirm('Delete this row?')) deleteEntryMutation.mutate(rowMenuId);
            }}>
              <Trash2 size={16} /> Delete Row
            </button>
          </div>
        </div>
      )}

      {/* ── Rename Column Modal ── */}
      {renameColModal && (
        <div className="modal-overlay" onClick={() => setRenameColModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Column</h3>
            <input className="modal-input" value={renameColValue} onChange={(e) => setRenameColValue(e.target.value)} placeholder="New column name" autoFocus />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setRenameColModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!renameColValue.trim()} onClick={() => renameColumnMutation.mutate()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dropdown Config Modal ── */}
      {dropdownConfigModal && (
        <div className="modal-overlay" onClick={() => setDropdownConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Dropdown Options</h3>
            <label className="modal-label">Options (comma-separated)</label>
            <input className="modal-input" value={dropdownConfigOptions} onChange={(e) => setDropdownConfigOptions(e.target.value)} placeholder="e.g. Active, Inactive, Pending" autoFocus />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDropdownConfigModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={() => updateDropdownMutation.mutate()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Column Type Modal ── */}
      {changeTypeModal && (
        <div className="modal-overlay" onClick={() => setChangeTypeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Change Column Type</h3>
            <p className="modal-p-text">
              Changing the type may affect existing data in this column.
            </p>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${changeTypeValue === t.id ? 'active' : ''}`} onClick={() => setChangeTypeValue(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setChangeTypeModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={() => changeColumnTypeMutation.mutate()}>
                Change Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Insert Column (Left / Right) Modal ── */}
      {insertColModal !== null && (
        <div className="modal-overlay" onClick={() => setInsertColModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Insert Column {insertColModal === 'left' ? 'Left' : 'Right'}</h3>
            <label className="modal-label">Column Name</label>
            <input className="modal-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="e.g. Amount" autoFocus />
            <label className="modal-label">Column Type</label>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${newColType === t.id ? 'active' : ''}`} onClick={() => setNewColType(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {newColType === 'dropdown' && (
              <>
                <label className="modal-label">Options (comma-separated)</label>
                <input className="modal-input" value={newColDropdownOpts} onChange={(e) => setNewColDropdownOpts(e.target.value)} placeholder="e.g. Active, Inactive, Pending" />
              </>
            )}
            {newColType === 'formula' && (
              <>
                <label className="modal-label">Formula</label>
                <input className="modal-input" value={newColFormula} onChange={(e) => setNewColFormula(e.target.value)} placeholder="e.g. {Marks}/{Full Marks}*100" />
              </>
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setInsertColModal(null)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!newColName.trim()} onClick={() => insertColumnMutation.mutate()}>
                Insert Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Modal ── */}
      {filterModal && (
        <div className="modal-overlay" onClick={() => setFilterModal(false)}>
          <div className="modal-content modal-max-70" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-flex">
               <h3 className="modal-title modal-title-no-margin">Filter Data</h3>
              {filters.length > 0 && (
                <button className="clear-all-btn" onClick={() => setFilters([])}>Clear All</button>
              )}
            </div>
            {filters.map((f, idx) => (
              <div key={idx} className="filter-row">
                <select className="modal-input filter-select" aria-label="Filter Column" title="Filter Column" value={f.columnId} onChange={(e) => { const newF = [...filters]; newF[idx].columnId = Number(e.target.value); setFilters(newF); }}>
                  {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="modal-input filter-operator" aria-label="Filter Operator" title="Filter Operator" value={f.operator} onChange={(e) => { const newF = [...filters]; newF[idx].operator = e.target.value; setFilters(newF); }}>
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                  <option value="gt">Greater than</option>
                  <option value="lt">Less than</option>
                  <option value="empty">Is empty</option>
                  <option value="not_empty">Not empty</option>
                </select>
                {!['empty', 'not_empty'].includes(f.operator) && (
                  <input className="modal-input filter-value" value={f.value} onChange={(e) => { const newF = [...filters]; newF[idx].value = e.target.value; setFilters(newF); }} placeholder="Value" />
                )}
                <button className="remove-filter-btn" aria-label="Remove Filter" title="Remove Filter" onClick={() => setFilters(filters.filter((_, i) => i !== idx))}>
                  <X size={16} />
                </button>
              </div>
            ))}
            <button className="toolbar-btn add-filter-btn" onClick={() => setFilters([...filters, { columnId: columns[0]?.id || 0, operator: 'contains', value: '' }])}>
              <Plus size={13} /> Add Filter
            </button>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => { setActiveFilters([]); setFilterModal(false); }}>Clear & Close</button>
              <button className="modal-confirm-btn" onClick={() => { setActiveFilters(filters); setFilterModal(false); }}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calc Type Modal ── */}
      {calcModal && (
        <div className="modal-overlay" onClick={() => setCalcModal(false)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">Calculation Type</div>
            {(['sum', 'average', 'count', 'min', 'max'] as CalcType[]).map((type) => (
              <button
                key={type}
                className={`context-item ${calcTypes[calcColId!] === type || (!calcTypes[calcColId!] && type === 'sum') ? 'active-calc' : ''}`}
                onClick={() => {
                  if (calcColId !== null) setCalcTypes({ ...calcTypes, [calcColId]: type });
                  setCalcModal(false);
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
                {(calcTypes[calcColId!] === type || (!calcTypes[calcColId!] && type === 'sum')) && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Date Picker Modal ── */}
      {dateModal && (
        <div className="modal-overlay" onClick={() => setDateModal(false)}>
          <div className="modal-content modal-max-360" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Select Date</h3>
            <div className="date-picker-flex">
              <div className="date-picker-flex-1">
                <label className="modal-label">Day</label>
                <input className="modal-input" value={dateDay} onChange={(e) => setDateDay(e.target.value)} type="number" maxLength={2} placeholder="DD" />
              </div>
              <div className="date-picker-flex-1">
                <label className="modal-label">Month</label>
                <input className="modal-input" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} type="number" maxLength={2} placeholder="MM" />
              </div>
              <div className="date-picker-flex-1-5">
                <label className="modal-label">Year</label>
                <input className="modal-input" value={dateYear} onChange={(e) => setDateYear(e.target.value)} type="number" maxLength={4} placeholder="YYYY" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDateModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={handleDateSelect}>Set Date</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dropdown Cell Modal ── */}
      {dropdownModal && (
        <div className="modal-overlay" onClick={() => setDropdownModal(false)}>
          <div className="modal-content modal-max-380" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Select Option</h3>
            <div className="dropdown-options-container">
              {dropdownOptions.map((opt, idx) => {
                const currentVal = dropdownEntryId ? localEntries.find((e) => e.id === dropdownEntryId)?.cells?.[dropdownColumnId?.toString() || ''] : '';
                const isSelected = currentVal === opt;
                return (
                  <div
                    key={idx}
                    className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (dropdownEntryId && dropdownColumnId) handleCellChange(dropdownEntryId, dropdownColumnId.toString(), opt);
                      setDropdownModal(false);
                    }}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check size={16} color="var(--navy)" />}
                  </div>
                );
              })}
            </div>
            <button className="modal-cancel-btn dropdown-clear-btn" onClick={() => {
              if (dropdownEntryId && dropdownColumnId) handleCellChange(dropdownEntryId, dropdownColumnId.toString(), '');
              setDropdownModal(false);
            }}>Clear Selection</button>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(false)}>
          <div className="modal-content modal-max-480" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Share Register</h3>

            {/* Share Link */}
            <div className="share-link-row">
              <div className="share-link-box">
                <Link2 size={14} />
                <span className="share-link-text">
                  {register.shareLink || 'Generate a share link'}
                </span>
              </div>
              {register.shareLink ? (
                <button className="share-copy-btn" onClick={() => navigator.clipboard.writeText(register.shareLink!)}>
                  <Copy size={12} /> Copy
                </button>
              ) : (
                <button className="share-copy-btn" onClick={() => shareLinkMutation.mutate()}>
                  <Link2 size={12} /> Generate
                </button>
              )}
            </div>

            {/* Add user */}
            <label className="modal-label">Add Person</label>
            <div className="share-add-row">
              <input className="modal-input share-phone-input" aria-label="Phone number" title="Phone number" value={sharePhone} onChange={(e) => setSharePhone(e.target.value)} placeholder="Phone number" />
              <select className="modal-input share-perm-select" aria-label="Permission Level" title="Permission Level" value={sharePermission} onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}>
                <option value="view">View</option>
                <option value="edit">Edit</option>
              </select>
              <button className="modal-confirm-btn" aria-label="Add User" title="Add User" onClick={() => sharePhone.trim() && addSharedUserMutation.mutate()}>
                <UserPlus size={14} />
              </button>
            </div>

            {/* Shared users */}
            {register.sharedWith && register.sharedWith.length > 0 && (
              <>
                <label className="modal-label shared-user-label">Shared With</label>
                {register.sharedWith.map((u) => (
                  <div key={u.id} className="shared-user-row">
                    <div className="shared-user-avatar">{u.name[0]}</div>
                    <div className="shared-user-info-wrapper">
                      <div className="shared-user-name">{u.name}</div>
                      <div className="shared-user-phone">{u.phone} • {u.permission}</div>
                    </div>
                    <button className="share-remove-btn" aria-label="Remove User" title="Remove User" onClick={() => removeSharedUserMutation.mutate(u.id)}>
                      <UserX size={16} />
                    </button>
                  </div>
                ))}
              </>
            )}

            <button className="modal-cancel-btn modal-close-btn" onClick={() => setShareModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ── Rename Page Modal ── */}
      {renamePageModal && (
        <div className="modal-overlay" onClick={() => setRenamePageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Page</h3>
            <input className="modal-input" value={renamePageValue} onChange={(e) => setRenamePageValue(e.target.value)} placeholder="Page name" autoFocus />
            <div className="modal-actions">
              <button
                className={`modal-cancel-btn ${pages.length > 1 ? 'modal-delete-page-btn' : ''}`}
                onClick={() => {
                  if (pages.length > 1 && renamePageId !== null) {
                    if (confirm('Delete this page and its entries?')) {
                      deletePageMutation.mutate(renamePageId);
                      setRenamePageModal(false);
                    }
                  } else {
                    setRenamePageModal(false);
                  }
                }}
              >
                {pages.length > 1 ? 'Delete' : 'Cancel'}
              </button>
              <button className="modal-confirm-btn" disabled={!renamePageValue.trim()} onClick={() => renamePageMutation.mutate()}>Rename</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
