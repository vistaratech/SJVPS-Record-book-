import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  Plus, MoreVertical, ChevronDown, Calendar, SortAsc, SortDesc,
  Hash, FlaskConical, Type as TypeIcon, ChevronRight, Pin, IndianRupee,
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const dummyId = Date.now();
        const newCol = {
          id: dummyId,
          registerId,
          name: newColName,
          type: newColType,
          position: prev.columns ? prev.columns.length : 0,
          dropdownOptions: newColType === 'dropdown' ? newColDropdownOpts.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          formula: newColType === 'formula' ? newColFormula : undefined,
          createdAt: new Date().toISOString()
        };
        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: [...(prev.columns || []), newCol]
        });
      }
      setNewColumnModal(false);
      return { prev };
    },
    onError: (err, newCol, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['register', registerId], context.prev);
      }
    },
    onSettled: () => {
      setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(registerId, colId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setColMenuId(null); },
  });

  const renameColumnMutation = useMutation({
    mutationFn: () => renameColumn(registerId, colMenuId!, renameColValue),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev && colMenuId !== null) {
        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) => 
            c.id === colMenuId ? { ...c, name: renameColValue } : c
          )
        });
      }
      setRenameColModal(false);
      return { prev };
    },
    onError: (err, vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['register', registerId], context.prev);
      }
    },
    onSettled: () => {
      setRenameColValue('');
      setColMenuId(null);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    },
  });

  const updateDropdownMutation = useMutation({
    mutationFn: () => updateColumnDropdownOptions(registerId, colMenuId!, dropdownConfigOptions.split(',').map((s) => s.trim()).filter(Boolean)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setDropdownConfigModal(false); },
  });

  const duplicateColumnMutation = useMutation({
    mutationFn: (colId: number) => duplicateColumn(registerId, colId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setColMenuId(null); },
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const colNode = prev.columns?.find((c: any) => c.id === colMenuId);
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
        newColumns.sort((a, b) => a.position - b.position);

        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: newColumns
        });
      }
      setInsertColModal(null);
      setColMenuId(null);
      return { prev };
    },
    onError: (err, variables, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['register', registerId], context.prev);
      }
    },
    onSettled: () => {
      setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
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
      updateEntry(registerId, entryId, { [columnId]: value }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['registers'], exact: false });
        queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      });
    }, 500);
  }, [registerId, queryClient]);

  const handleSort = (colId: number) => {
    if (sortCol === colId) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  const openDatePicker = useCallback((entryId: number, colId: number, currentVal: string) => {
    const parts = currentVal?.split('/') || [];
    setDateDay(parts[0] || ''); setDateMonth(parts[1] || ''); setDateYear(parts[2] || '');
    setDateEntryId(entryId); setDateColumnId(colId); setDateModal(true);
  }, []);

  const handleDateSelect = () => {
    const dateStr = `${dateDay.padStart(2, '0')}/${dateMonth.padStart(2, '0')}/${dateYear}`;
    if (dateEntryId && dateColumnId) handleCellChange(dateEntryId, dateColumnId.toString(), dateStr);
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

  const toggleSelectAll = () => {
    if (selectedRows.size === displayEntries.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(displayEntries.map((e) => e.id)));
  };

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

  const visibleColumns = useMemo(() => columns.filter((col) => !hiddenColumns.has(col.id)), [columns, hiddenColumns]);

  if (isLoading) return (
    <div className="center-loader">
      <div className="spinner dark spinner-large" />
    </div>
  );
  if (!register) return <div className="empty-state"><p>Register not found</p></div>;

  return (
    <div className="register-layout">
      {/* ── Header ── */}
      <RegisterHeader 
        register={register} 
        setShareModal={setShareModal} 
        handleExportExcel={handleExportExcel} 
      />

      {/* ── Toolbar ── */}
      <RegisterToolbar 
        search={search}
        setSearch={setSearch}
        activeFilters={activeFilters}
        setFilters={setFilters}
        setFilterModal={setFilterModal}
        addEntryMutation={addEntryMutation}
        setNewColName={setNewColName}
        setNewColType={setNewColType}
        setNewColDropdownOpts={setNewColDropdownOpts}
        setNewColFormula={setNewColFormula}
        setNewColumnModal={setNewColumnModal}
        hiddenColumns={hiddenColumns} setHiddenColumns={setHiddenColumns} registerId={registerId} hideColumn={(r, c, h) => hideColumnMutation.mutate({ colId: c, hidden: h })}
        selectedRows={selectedRows} displayEntries={displayEntries} columns={columns} bulkDeleteMutation={bulkDeleteMutation}
        setRowCountMutation={setRowCountMutation}
      />

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
              <th className="serial">S.No.</th>
              {visibleColumns.map((col) => {
                const nameL = (col.name || '').toLowerCase();
                const isPayment = nameL.includes('amount') || nameL.includes('fee') || nameL.includes('payment') || nameL.includes('balance') || nameL.includes('price');
                const IconComponent = isPayment ? <IndianRupee size={12} /> : 
                  col.type === 'number' ? <Hash size={12} /> : 
                  col.type === 'date' ? <Calendar size={12} /> : 
                  col.type === 'dropdown' ? <ChevronDown size={12} /> : 
                  col.type === 'formula' ? <FlaskConical size={12} /> : 
                  <TypeIcon size={12} />;

                return (
                <th key={col.id} onClick={() => handleSort(col.id)} className="col-header-cell">
                  <div className="col-header-inner">
                    {IconComponent}
                    <span>{col.name}</span>
                    {sortCol === col.id && (sortDir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
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
            {displayEntries.map((entry, idx) => (
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
              />
            ))}

            {/* Mock rows for empty template registers */}
            {displayEntries.length === 0 && columns.length > 0 && [1, 2, 3].map((n) => (
              <tr key={`mock-${n}`} className="mock" onClick={() => addEntryMutation.mutate()}>
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

      {/* ── Context Menus ── */}
      <RegisterContextMenus 
        colMenuId={colMenuId} setColMenuId={setColMenuId} columns={columns}
        sortCol={sortCol} sortDir={sortDir} setSortCol={setSortCol} setSortDir={setSortDir}
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
        calcModal={calcModal} setCalcModal={setCalcModal} calcTypes={calcTypes} setCalcTypes={setCalcTypes} calcColId={calcColId}
        dateModal={dateModal} setDateModal={setDateModal}
        dateDay={dateDay} setDateDay={setDateDay} dateMonth={dateMonth} setDateMonth={setDateMonth} dateYear={dateYear} setDateYear={setDateYear}
        handleDateSelect={handleDateSelect}
        dropdownModal={dropdownModal} setDropdownModal={setDropdownModal}
        dropdownOptions={dropdownOptions} dropdownEntryId={dropdownEntryId} dropdownColumnId={dropdownColumnId}
        localEntries={localEntries} handleCellChange={handleCellChange}
      />
    </div>
  );
}
