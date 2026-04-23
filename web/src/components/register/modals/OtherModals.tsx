import { Check } from 'lucide-react';
import { type Entry } from '../../../lib/api';

interface OtherModalsProps {
  // Rename Page
  renamePageModal: boolean;
  setRenamePageModal: (v: boolean) => void;
  renamePageValue: string;
  setRenamePageValue: (v: string) => void;
  renamePageId: number | null;
  pages: any[];
  deletePageMutation: any;
  renamePageMutation: any;

  // Calc
  calcModal: boolean;
  setCalcModal: (v: boolean) => void;
  calcTypes: Record<number, string>;
  setCalcTypes: (v: Record<number, string>) => void;
  calcColId: number | null;
  columns?: any[]; // Pass columns down to check column type

  // Date Picker
  dateModal: boolean;
  setDateModal: (v: boolean) => void;
  dateDay: string;
  setDateDay: (v: string) => void;
  dateMonth: string;
  setDateMonth: (v: string) => void;
  dateYear: string;
  setDateYear: (v: string) => void;
  handleDateSelect: () => void;

  // Dropdown Cell
  dropdownModal: boolean;
  setDropdownModal: (v: boolean) => void;
  dropdownOptions: string[];
  dropdownEntryId: number | null;
  dropdownColumnId: number | null;
  localEntries: Entry[];
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  dropdownRect?: { top: number, left: number, width: number } | null;
}

export function OtherModals(props: OtherModalsProps) {
  const {
    renamePageModal, setRenamePageModal, renamePageValue, setRenamePageValue, renamePageId, pages, deletePageMutation, renamePageMutation,
    calcModal, setCalcModal, calcTypes, setCalcTypes, calcColId, columns,
    dateModal, setDateModal, dateDay, setDateDay, dateMonth, setDateMonth, dateYear, setDateYear, handleDateSelect,
    dropdownModal, setDropdownModal, dropdownOptions, dropdownEntryId, dropdownColumnId, localEntries, handleCellChange
  } = props;

  const getCalcOptions = () => {
    if (!calcColId || !columns) return [];
    const col = columns.find(c => c.id === calcColId);
    const isNumeric = col?.type === 'number' || col?.type === 'formula' || col?.type === 'currency';
    return isNumeric 
      ? ['sum', 'average', 'count', 'min', 'max'] 
      : ['count', 'filled', 'empty'];
  };

  const getCalcDefault = () => {
    if (!calcColId || !columns) return 'count';
    const col = columns.find(c => c.id === calcColId);
    return (col?.type === 'number' || col?.type === 'formula' || col?.type === 'currency') ? 'sum' : 'count';
  };

  return (
    <>
      {/* ── Rename Page ── */}
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

      {/* ── Calc ── */}
      {calcModal && (
        <div className="modal-overlay" onClick={() => setCalcModal(false)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">Calculation Type</div>
            {getCalcOptions().map((type) => {
              const isActive = calcTypes[calcColId!] === type || (!calcTypes[calcColId!] && type === getCalcDefault());
              return (
                <button
                  key={type}
                  className={`context-item ${isActive ? 'active-calc' : ''}`}
                  onClick={() => {
                    if (calcColId !== null) setCalcTypes({ ...calcTypes, [calcColId]: type });
                    setCalcModal(false);
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                  {isActive && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Date Picker ── */}
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

      {/* ── Dropdown Cell ── */}
      {dropdownModal && (
        <>
          <div className="dropdown-overlay-transparent" onClick={() => setDropdownModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
          <div 
            className="dropdown-popover"
            style={(props as any).dropdownRect ? {
              position: 'fixed',
              top: (props as any).dropdownRect.top + 4,
              left: (props as any).dropdownRect.left,
              minWidth: Math.max((props as any).dropdownRect.width, 150),
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 1001,
              maxHeight: '250px',
              overflowY: 'auto',
              padding: '4px 0'
            } : {
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '300px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1001, padding: '12px'
            }}
          >
            {(!(props as any).dropdownRect) && <h3 style={{ margin: '0 0 10px 8px', fontSize: '14px' }}>Select Options</h3>}
            <div className="dropdown-options-container" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {dropdownOptions.map((opt, idx) => {
                const currentVal = dropdownEntryId ? localEntries.find((e) => e.id === dropdownEntryId)?.cells?.[dropdownColumnId?.toString() || ''] : '';
                const selectedValues = currentVal ? currentVal.split(',').map(s => s.trim()) : [];
                const isSelected = selectedValues.includes(opt);
                
                return (
                  <div
                    key={idx}
                    className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                    style={{ 
                      padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      cursor: 'pointer', fontSize: '13px', borderRadius: '4px', margin: '0 4px',
                      background: isSelected ? 'var(--blue-light)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'inherit'
                    }}
                    onClick={() => {
                      if (dropdownEntryId != null && dropdownColumnId != null) {
                        let newValues;
                        if (isSelected) {
                          newValues = selectedValues.filter(v => v !== opt);
                        } else {
                          newValues = [...selectedValues, opt];
                        }
                        handleCellChange(dropdownEntryId, dropdownColumnId.toString(), newValues.join(', '));
                      }
                    }}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check size={14} color="var(--primary)" />}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '4px 8px', marginTop: '6px', borderTop: '1px solid var(--border-light)' }}>
              <button 
                style={{ width: '100%', padding: '6px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }}
                onClick={() => {
                  if (dropdownEntryId != null && dropdownColumnId != null) handleCellChange(dropdownEntryId, dropdownColumnId.toString(), '');
                }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
