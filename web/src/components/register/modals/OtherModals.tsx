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
}

export function OtherModals(props: OtherModalsProps) {
  const {
    renamePageModal, setRenamePageModal, renamePageValue, setRenamePageValue, renamePageId, pages, deletePageMutation, renamePageMutation,
    calcModal, setCalcModal, calcTypes, setCalcTypes, calcColId,
    dateModal, setDateModal, dateDay, setDateDay, dateMonth, setDateMonth, dateYear, setDateYear, handleDateSelect,
    dropdownModal, setDropdownModal, dropdownOptions, dropdownEntryId, dropdownColumnId, localEntries, handleCellChange
  } = props;

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
            {(['sum', 'average', 'count', 'min', 'max'] as const).map((type) => (
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
    </>
  );
}
