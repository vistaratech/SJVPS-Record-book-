import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRegister, addColumn, deleteColumn, renameColumn, updateColumnDropdownOptions,
  addEntry, updateEntry, deleteEntry, duplicateEntry, bulkDeleteEntries,
  addPage, renamePage, deletePage,
  evaluateFormula, calculateColumnStats, generateCSV,
  generateShareLink, addSharedUser, removeSharedUser,
  type Entry,
} from '../lib/api';
import {
  ArrowLeft, Plus, Search, Filter, Download, Share2, MoreVertical,
  Pencil, Trash2, Copy, ChevronDown, Calendar, X, Check, SortAsc, SortDesc,
  Hash, FlaskConical, Type as TypeIcon, AlertCircle, FileText, UserX,
  ChevronRight, Link2, UserPlus,
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
  const [filterModal, setFilterModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [calcModal, setCalcModal] = useState(false);

  // New column form
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [newColDropdownOpts, setNewColDropdownOpts] = useState('');
  const [newColFormula, setNewColFormula] = useState('');

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

  const handleExportCSV = () => {
    if (!register) return;
    const csv = generateCSV(register, currentPageIndex);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${register.name}.csv`; a.click();
    URL.revokeObjectURL(url);
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner dark" style={{ width: 32, height: 32 }} />
    </div>
  );
  if (!register) return <div className="empty-state"><p>Register not found</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* ── Header ── */}
      <div className="register-header">
        <button className="register-header-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={14} />
        </button>
        <h1 className="register-header-title">{register.name}</h1>
        <button className="register-header-btn" onClick={() => setShareModal(true)}>
          <Share2 size={14} /> Share
        </button>
        <button className="register-header-btn" onClick={handleExportCSV}>
          <Download size={14} /> Export
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
              <th className="serial" style={{ width: 40 }}>
                <input type="checkbox" checked={selectedRows.size === displayEntries.length && displayEntries.length > 0} onChange={toggleSelectAll} />
              </th>
              <th className="serial">S.No.</th>
              {columns.map((col) => (
                <th key={col.id} onClick={() => handleSort(col.id)} style={{ minWidth: 140 }}>
                  <div className="col-header-inner">
                    {col.type === 'number' ? <Hash size={12} /> : col.type === 'date' ? <Calendar size={12} /> : col.type === 'dropdown' ? <ChevronDown size={12} /> : col.type === 'formula' ? <FlaskConical size={12} /> : <TypeIcon size={12} />}
                    <span>{col.name}</span>
                    {sortCol === col.id && (sortDir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                    <button
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--muted)' }}
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
                  <input type="checkbox" checked={selectedRows.has(entry.id)} onChange={() => toggleSelectRow(entry.id)} />
                </td>
                <td className="serial">{idx + 1}</td>
                {columns.map((col) => (
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
                  <button className="row-menu-btn" onClick={() => setRowMenuId(rowMenuId === entry.id ? null : entry.id)}>
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
                {columns.map((col) => (
                  <td key={col.id}><div style={{ padding: '0 12px', color: 'var(--placeholder)', fontSize: 13 }}>{col.name}...</div></td>
                ))}
                <td className="actions" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Calc Bar ── */}
      {columns.some((c) => c.type === 'number' || c.type === 'formula') && displayEntries.length > 0 && (
        <div className="calc-bar">
          <div className="calc-cell" style={{ width: 40 }} />
          <div className="calc-cell" style={{ width: 50, cursor: 'default' }}>
            <span className="calc-label">Σ</span>
          </div>
          {columns.map((col) => (
            <div
              key={col.id}
              className="calc-cell"
              style={{ minWidth: 140, flex: 1 }}
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
          <div className="calc-cell" style={{ width: 44 }} />
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

      {/* ── Column Context Menu ── */}
      {colMenuId !== null && (
        <div className="modal-overlay" onClick={() => setColMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">{columns.find((c) => c.id === colMenuId)?.name || 'Column'}</div>
            <button className="context-item" onClick={() => {
              setRenameColValue(columns.find((c) => c.id === colMenuId)?.name || '');
              setRenameColModal(true);
            }}>
              <Pencil size={16} /> Rename Column
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
            <button className="context-item" onClick={() => handleSort(colMenuId)}><SortAsc size={16} /> Sort</button>
            <button className="context-item danger" onClick={() => {
              if (confirm('Delete this column?')) deleteColumnMutation.mutate(colMenuId);
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

      {/* ── Filter Modal ── */}
      {filterModal && (
        <div className="modal-overlay" onClick={() => setFilterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '70vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Filter Data</h3>
              {filters.length > 0 && (
                <button style={{ background: 'none', border: 'none', color: 'var(--destructive)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setFilters([])}>Clear All</button>
              )}
            </div>
            {filters.map((f, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select className="modal-input" style={{ flex: 1, marginBottom: 0 }} value={f.columnId} onChange={(e) => { const newF = [...filters]; newF[idx].columnId = Number(e.target.value); setFilters(newF); }}>
                  {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="modal-input" style={{ width: 120, marginBottom: 0 }} value={f.operator} onChange={(e) => { const newF = [...filters]; newF[idx].operator = e.target.value; setFilters(newF); }}>
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                  <option value="gt">Greater than</option>
                  <option value="lt">Less than</option>
                  <option value="empty">Is empty</option>
                  <option value="not_empty">Not empty</option>
                </select>
                {!['empty', 'not_empty'].includes(f.operator) && (
                  <input className="modal-input" style={{ width: 100, marginBottom: 0 }} value={f.value} onChange={(e) => { const newF = [...filters]; newF[idx].value = e.target.value; setFilters(newF); }} placeholder="Value" />
                )}
                <button style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }} onClick={() => setFilters(filters.filter((_, i) => i !== idx))}>
                  <X size={16} />
                </button>
              </div>
            ))}
            <button className="toolbar-btn" style={{ marginBottom: 16 }} onClick={() => setFilters([...filters, { columnId: columns[0]?.id || 0, operator: 'contains', value: '' }])}>
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
                className={`context-item ${calcTypes[calcColId!] === type || (!calcTypes[calcColId!] && type === 'sum') ? 'active' : ''}`}
                style={calcTypes[calcColId!] === type || (!calcTypes[calcColId!] && type === 'sum') ? { background: 'rgba(27,42,74,0.08)', fontWeight: 700 } : {}}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 className="modal-title">Select Date</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label className="modal-label">Day</label>
                <input className="modal-input" value={dateDay} onChange={(e) => setDateDay(e.target.value)} type="number" maxLength={2} placeholder="DD" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="modal-label">Month</label>
                <input className="modal-input" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} type="number" maxLength={2} placeholder="MM" />
              </div>
              <div style={{ flex: 1.5 }}>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 className="modal-title">Select Option</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
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
            <button className="modal-cancel-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => {
              if (dropdownEntryId && dropdownColumnId) handleCellChange(dropdownEntryId, dropdownColumnId.toString(), '');
              setDropdownModal(false);
            }}>Clear Selection</button>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="modal-title">Share Register</h3>

            {/* Share Link */}
            <div className="share-link-row">
              <div className="share-link-box">
                <Link2 size={14} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <input className="modal-input" style={{ flex: 1, marginBottom: 0 }} value={sharePhone} onChange={(e) => setSharePhone(e.target.value)} placeholder="Phone number" />
              <select className="modal-input" style={{ width: 100, marginBottom: 0 }} value={sharePermission} onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}>
                <option value="view">View</option>
                <option value="edit">Edit</option>
              </select>
              <button className="modal-confirm-btn" onClick={() => sharePhone.trim() && addSharedUserMutation.mutate()}>
                <UserPlus size={14} />
              </button>
            </div>

            {/* Shared users */}
            {register.sharedWith && register.sharedWith.length > 0 && (
              <>
                <label className="modal-label" style={{ marginTop: 16 }}>Shared With</label>
                {register.sharedWith.map((u) => (
                  <div key={u.id} className="shared-user-row">
                    <div className="shared-user-avatar">{u.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.phone} • {u.permission}</div>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }} onClick={() => removeSharedUserMutation.mutate(u.id)}>
                      <UserX size={16} />
                    </button>
                  </div>
                ))}
              </>
            )}

            <button className="modal-cancel-btn" style={{ width: '100%', marginTop: 20 }} onClick={() => setShareModal(false)}>Close</button>
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
                className={`modal-cancel-btn ${pages.length > 1 ? '' : ''}`}
                style={pages.length > 1 ? { color: 'var(--destructive)' } : {}}
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
