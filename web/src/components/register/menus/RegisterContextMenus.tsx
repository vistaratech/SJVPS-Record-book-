import { Hash, Calendar, ChevronDown, FlaskConical, Type as TypeIcon, SortAsc, Check, SortDesc, Pencil, ArrowLeftRight, Copy, ArrowRight, ChevronsLeftRight, Pin, EyeOff, Eraser, Trash2, FileText, FileSpreadsheet, Share2, ArrowLeft } from 'lucide-react';
import { type Column } from '../../../lib/api';

interface RegisterContextMenusProps {
  // Column Menu
  colMenuId: number | null;
  setColMenuId: (id: number | null) => void;
  setActiveModalColId: (id: number | null) => void;
  columns: Column[];
  sortCol: number | null;
  sortDir: 'asc' | 'desc' | null;
  setSortCol: (id: number | null) => void;
  setSortDir: (dir: 'asc' | 'desc' | null) => void;
  setRenameColValue: (v: string) => void;
  setRenameColModal: (v: boolean) => void;
  setChangeTypeValue: (v: string) => void;
  setChangeTypeModal: (v: boolean) => void;
  setDropdownConfigOptions: (v: string) => void;
  setDropdownConfigModal: (v: boolean) => void;
  duplicateColumnMutation: any;
  setNewColName: (v: string) => void;
  setNewColType: (v: string) => void;
  setNewColDropdownOpts: (v: string) => void;
  setNewColFormula: (v: string) => void;
  setInsertColModal: (v: 'left' | 'right' | null) => void;
  moveColumnMutation: any;
  frozenColumns: Set<number>;
  setFrozenColumns: (v: Set<number>) => void;
  freezeColumn: (regId: number, colId: number, freeze: boolean) => void;
  registerId: number;
  hiddenColumns: Set<number>;
  setHiddenColumns: (v: Set<number>) => void;
  hideColumn: (regId: number, colId: number, hide: boolean) => void;
  clearColumnDataMutation: any;
  deleteColumnMutation: any;

  // Row Menu
  rowMenuId: number | null;
  setRowMenuId: (id: number | null) => void;
  duplicateEntryMutation: any;
  deleteEntryMutation: any;
  handleRowDownloadPDF: (entryId: number) => void;
  handleRowDownloadExcel: (entryId: number) => void;
  handleRowShareText: (entryId: number) => void;
}

export function RegisterContextMenus(props: RegisterContextMenusProps) {
  const {
    colMenuId, setColMenuId, setActiveModalColId, columns, sortCol, sortDir, setSortCol, setSortDir,
    setRenameColValue, setRenameColModal, setChangeTypeValue, setChangeTypeModal,
    setDropdownConfigOptions, setDropdownConfigModal, duplicateColumnMutation,
    setNewColName, setNewColType, setNewColDropdownOpts, setNewColFormula, setInsertColModal,
    moveColumnMutation, frozenColumns, setFrozenColumns, freezeColumn, registerId,
    hiddenColumns, setHiddenColumns, hideColumn, clearColumnDataMutation, deleteColumnMutation,
    rowMenuId, setRowMenuId, duplicateEntryMutation, deleteEntryMutation,
    handleRowDownloadPDF, handleRowDownloadExcel, handleRowShareText
  } = props;

  return (
    <>
      {/* ── Column Context Menu ── */}
      {colMenuId !== null && (
        <div className="modal-overlay" onClick={() => setColMenuId(null)}>
          <div className="context-menu context-menu-wide" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">
              {(() => {
                const col = columns.find((c) => c.id === colMenuId);
                const Icon = col?.type === 'number' ? Hash :
                            col?.type === 'date' ? Calendar :
                            col?.type === 'dropdown' ? ChevronDown :
                            col?.type === 'formula' ? FlaskConical : TypeIcon;
                return (
                  <>
                    <Icon size={14} /> {col?.name || 'Column'}
                    <span className="context-type-badge">{col?.type}</span>
                  </>
                );
              })()}
            </div>

            <div className="context-section-label">Sort</div>
            <button className="context-item" onClick={() => { setSortCol(colMenuId); setSortDir('asc'); setColMenuId(null); }}>
              <SortAsc size={16} /> Sort A → Z
              {sortCol === colMenuId && sortDir === 'asc' && <Check size={14} className="context-check" />}
            </button>
            <button className="context-item" onClick={() => { setSortCol(colMenuId); setSortDir('desc'); setColMenuId(null); }}>
              <SortDesc size={16} /> Sort Z → A
              {sortCol === colMenuId && sortDir === 'desc' && <Check size={14} className="context-check" />}
            </button>

            <div className="context-divider" />
            <div className="context-section-label">Edit</div>
            <button className="context-item" onClick={() => {
              setRenameColValue(columns.find((c) => c.id === colMenuId)?.name || '');
              setActiveModalColId(colMenuId);
              setRenameColModal(true); setColMenuId(null);
            }}>
              <Pencil size={16} /> Rename Column
            </button>
            <button className="context-item" onClick={() => {
              setChangeTypeValue(columns.find((c) => c.id === colMenuId)?.type || 'text');
              setActiveModalColId(colMenuId);
              setChangeTypeModal(true); setColMenuId(null);
            }}>
              <ArrowLeftRight size={16} /> Change Column Type
            </button>
            {columns.find((c) => c.id === colMenuId)?.type === 'dropdown' && (
              <button className="context-item" onClick={() => {
                const col = columns.find((c) => c.id === colMenuId);
                setDropdownConfigOptions(col?.dropdownOptions?.join(', ') || '');
                setActiveModalColId(colMenuId);
                setDropdownConfigModal(true); setColMenuId(null);
              }}>
                <ChevronDown size={16} /> Edit Dropdown Options
              </button>
            )}

            <div className="context-divider" />
            <div className="context-section-label">Insert & Copy</div>
            <button className="context-item" onClick={() => duplicateColumnMutation.mutate(colMenuId)}>
              <Copy size={16} /> Duplicate Column
            </button>
            <button className="context-item" onClick={() => {
              setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
              setActiveModalColId(colMenuId);
              setInsertColModal('left'); setColMenuId(null);
            }}>
              <ArrowLeft size={16} /> Insert Column Left
            </button>
            <button className="context-item" onClick={() => {
              setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
              setActiveModalColId(colMenuId);
              setInsertColModal('right'); setColMenuId(null);
            }}>
              <ArrowRight size={16} /> Insert Column Right
            </button>

            <div className="context-divider" />
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
              const isFrozen = newFrozen.has(colMenuId);
              if (isFrozen) newFrozen.delete(colMenuId); else newFrozen.add(colMenuId);
              setFrozenColumns(newFrozen);
              freezeColumn(registerId, colMenuId, !isFrozen);
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
            <button className="context-item danger" onClick={() => { if (confirm('Clear all data?')) clearColumnDataMutation.mutate(colMenuId); }}>
              <Eraser size={16} /> Clear Column Data
            </button>
            <button className="context-item danger" onClick={() => { if (confirm('Delete column?')) deleteColumnMutation.mutate(colMenuId); }}>
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

            <button className="context-item" onClick={() => { handleRowDownloadPDF(rowMenuId); setRowMenuId(null); }}>
              <FileText size={16} />
              <div className="context-item-info">
                <span>Download as PDF</span>
                <span className="context-item-desc">All columns included</span>
              </div>
            </button>
            <button className="context-item" onClick={() => { handleRowDownloadExcel(rowMenuId); setRowMenuId(null); }}>
              <FileSpreadsheet size={16} />
              <div className="context-item-info">
                <span>Download as Excel</span>
                <span className="context-item-desc">All columns included</span>
              </div>
            </button>
            <button className="context-item" onClick={() => { handleRowShareText(rowMenuId); setRowMenuId(null); }}>
              <Share2 size={16} />
              <div className="context-item-info">
                <span>Share as Text</span>
                <span className="context-item-desc">All columns included</span>
              </div>
            </button>

            <div className="context-divider" />

            <button className="context-item" onClick={() => duplicateEntryMutation.mutate(rowMenuId)}>
              <Copy size={16} /> Duplicate Record
            </button>

            <div className="context-divider" />

            <button className="context-item danger" onClick={() => { if (confirm('Delete row?')) deleteEntryMutation.mutate(rowMenuId); }}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
