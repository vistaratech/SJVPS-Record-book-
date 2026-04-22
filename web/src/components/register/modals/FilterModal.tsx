import { useState, useMemo } from 'react';
import { Search, X, Hash, Calendar, ChevronDown, FlaskConical, Type as TypeIcon, ChevronRight, Filter, Plus } from 'lucide-react';
import { type Column } from '../../../lib/api';

export interface FilterRule {
  columnId: number;
  operator: string;
  value: string;
  value2?: string; // For "between" operators
}

interface FilterModalProps {
  filterModal: boolean;
  setFilterModal: (v: boolean) => void;
  filters: FilterRule[];
  setFilters: (v: FilterRule[]) => void;
  setActiveFilters: (v: FilterRule[]) => void;
  columns: Column[];
}

/* ── Operator definitions per column type ── */
const TEXT_OPS = [
  { key: 'contains', label: 'Contains' },
  { key: 'not_contains', label: 'Does Not Contain' },
  { key: 'equals', label: 'Is' },
  { key: 'not_equals', label: 'Is Not' },
  { key: 'starts_with', label: 'Starts With' },
  { key: 'ends_with', label: 'Ends With' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

const NUMBER_OPS = [
  { key: 'eq', label: 'Equals To' },
  { key: 'gt', label: 'Greater Than' },
  { key: 'gte', label: 'Greater Than or Equal To' },
  { key: 'lt', label: 'Less Than' },
  { key: 'lte', label: 'Less Than or Equal To' },
  { key: 'between', label: 'In Between' },
  { key: 'not_between', label: 'Not In Between' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

const DATE_OPS = [
  { key: 'date_between', label: 'In Between Dates' },
  { key: 'date_not_between', label: 'Not Between Dates' },
  { key: 'date_is', label: 'Is' },
  { key: 'date_not', label: 'Is Not' },
  { key: 'date_before', label: 'Is Before' },
  { key: 'date_after', label: 'Is After' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

const DROPDOWN_OPS = [
  { key: 'equals', label: 'Is' },
  { key: 'not_equals', label: 'Is Not' },
  { key: 'empty', label: 'Is Empty' },
  { key: 'not_empty', label: 'Is Not Empty' },
];

function getOpsForType(type: string) {
  switch (type) {
    case 'number': return NUMBER_OPS;
    case 'formula': return NUMBER_OPS;
    case 'date': return DATE_OPS;
    case 'dropdown': return DROPDOWN_OPS;
    default: return TEXT_OPS;
  }
}

function getColumnIcon(type: string) {
  switch (type) {
    case 'number': return Hash;
    case 'date': return Calendar;
    case 'dropdown': return ChevronDown;
    case 'formula': return FlaskConical;
    default: return TypeIcon;
  }
}

const NO_VALUE_OPS = ['empty', 'not_empty'];
const BETWEEN_OPS = ['between', 'not_between', 'date_between', 'date_not_between'];

export function FilterModal({
  filterModal, setFilterModal,
  filters, setFilters, setActiveFilters,
  columns,
}: FilterModalProps) {
  // "add filter" wizard state
  const [addingFilter, setAddingFilter] = useState(false);
  const [colSearch, setColSearch] = useState('');
  const [selectedColId, setSelectedColId] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');

  const filteredCols = useMemo(() => {
    if (!colSearch) return columns;
    const q = colSearch.toLowerCase();
    return columns.filter(c => c.name.toLowerCase().includes(q));
  }, [columns, colSearch]);

  const selectedCol = columns.find(c => c.id === selectedColId);
  const ops = selectedCol ? getOpsForType(selectedCol.type) : [];

  const resetWizard = () => {
    setAddingFilter(false);
    setColSearch('');
    setSelectedColId(null);
    setSelectedOp(null);
    setVal1('');
    setVal2('');
  };

  const handleAddFilter = () => {
    if (selectedColId === null || !selectedOp) return;
    
    // Validation
    if (!NO_VALUE_OPS.includes(selectedOp)) {
      if (!val1.trim()) return;
      if (BETWEEN_OPS.includes(selectedOp) && !val2.trim()) return;
    }

    const newFilter: FilterRule = {
      columnId: selectedColId,
      operator: selectedOp,
      value: val1.trim(),
      value2: BETWEEN_OPS.includes(selectedOp) ? val2.trim() : undefined,
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    resetWizard();
  };

  const handleRemoveFilter = (idx: number) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    setActiveFilters([...filters]);
    setFilterModal(false);
    resetWizard();
  };

  const handleClearClose = () => {
    setFilters([]);
    setActiveFilters([]);
    setFilterModal(false);
    resetWizard();
  };

  const getOpLabel = (opKey: string, colType: string) => {
    const allOps = getOpsForType(colType);
    return allOps.find(o => o.key === opKey)?.label || opKey;
  };

  const getInputType = (op: string, colType: string) => {
    if (colType === 'date' || op.startsWith('date_')) return 'date';
    if (colType === 'number' || colType === 'formula') return 'number';
    return 'text';
  };

  if (!filterModal) return null;

  return (
    <div className="modal-overlay" onClick={() => { setFilterModal(false); resetWizard(); }}>
      <div className="modal-content filter-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header-flex">
          <h3 className="modal-title modal-title-no-margin">
            <Filter size={16} /> Filter Data
          </h3>
          {filters.length > 0 && (
            <button className="clear-all-btn" onClick={() => setFilters([])}>Clear All</button>
          )}
        </div>

        {/* ── Active Filters List ── */}
        {filters.length > 0 && (
          <div className="filter-active-list">
            {filters.map((f, idx) => {
              const col = columns.find(c => c.id === f.columnId);
              const Icon = getColumnIcon(col?.type || 'text');
              return (
                <div key={idx} className="filter-chip">
                  <Icon size={13} />
                  <span className="filter-chip-col">{col?.name || 'Col'}</span>
                  <span className="filter-chip-op">{getOpLabel(f.operator, col?.type || 'text')}</span>
                  {!NO_VALUE_OPS.includes(f.operator) && (
                    <span className="filter-chip-val">"{f.value}"</span>
                  )}
                  {BETWEEN_OPS.includes(f.operator) && f.value2 && (
                    <span className="filter-chip-val">to "{f.value2}"</span>
                  )}
                  <button className="filter-chip-remove" onClick={() => handleRemoveFilter(idx)} aria-label="Remove filter">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add Filter Wizard ── */}
        {!addingFilter ? (
          <button className="filter-add-btn" onClick={() => setAddingFilter(true)}>
            <Plus size={14} /> Add Filter
          </button>
        ) : (
          <div className="filter-wizard">
            <div className="filter-wizard-header">
              <span className="filter-wizard-title">ADD FILTER</span>
              <button className="filter-wizard-close" onClick={resetWizard}><X size={14} /></button>
            </div>

            {/* Step 1: Column list */}
            <div className="filter-col-search">
              <Search size={14} />
              <input
                placeholder="Search columns..."
                value={colSearch}
                onChange={(e) => setColSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="filter-col-list">
              {filteredCols.map(col => {
                const Icon = getColumnIcon(col.type);
                const isSelected = col.id === selectedColId;
                return (
                  <button
                    key={col.id}
                    className={`filter-col-item ${isSelected ? 'active' : ''}`}
                    onClick={() => { setSelectedColId(col.id); setSelectedOp(null); setVal1(''); setVal2(''); }}
                  >
                    <Icon size={14} />
                    <span>{col.name}</span>
                    {isSelected && <ChevronRight size={14} className="filter-col-arrow" />}
                  </button>
                );
              })}
            </div>

            {/* Step 2: Condition list (shows when column is selected) */}
            {selectedCol && (
              <>
                <div className="filter-section-label">{selectedCol.name.toUpperCase()}</div>
                <div className="filter-op-list">
                  {ops.map(op => (
                    <button
                      key={op.key}
                      className={`filter-op-item ${selectedOp === op.key ? 'active' : ''}`}
                      onClick={() => { setSelectedOp(op.key); setVal1(''); setVal2(''); }}
                    >
                      <div className={`filter-radio ${selectedOp === op.key ? 'checked' : ''}`} />
                      <span>{op.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 3: Value input (shows when condition needs a value) */}
            {selectedOp && !NO_VALUE_OPS.includes(selectedOp) && (
              <div className="filter-value-area">
                {selectedCol?.type === 'dropdown' ? (
                  <select
                    className="modal-input"
                    value={val1}
                    onChange={(e) => setVal1(e.target.value)}
                  >
                    <option value="">Select value...</option>
                    {(selectedCol.dropdownOptions || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="modal-input"
                    type={getInputType(selectedOp, selectedCol?.type || 'text')}
                    placeholder={BETWEEN_OPS.includes(selectedOp) ? 'From value...' : 'Enter value...'}
                    value={val1}
                    onChange={(e) => setVal1(e.target.value)}
                    autoFocus
                  />
                )}
                {BETWEEN_OPS.includes(selectedOp) && (
                  <input
                    className="modal-input"
                    type={getInputType(selectedOp, selectedCol?.type || 'text')}
                    placeholder="To value..."
                    value={val2}
                    onChange={(e) => setVal2(e.target.value)}
                  />
                )}
              </div>
            )}

            {/* Wizard footer */}
            <div className="filter-wizard-actions">
              <button className="modal-cancel-btn" onClick={resetWizard}>Cancel</button>
              <button
                className="modal-confirm-btn filter-confirm-btn"
                disabled={
                  selectedColId === null ||
                  !selectedOp ||
                  (!NO_VALUE_OPS.includes(selectedOp) && !val1) ||
                  (BETWEEN_OPS.includes(selectedOp) && !val2)
                }
                onClick={handleAddFilter}
              >
                Add Filter
              </button>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {filters.length === 0 && !addingFilter && (
          <div className="filter-empty-state">
            <Filter size={28} />
            <p>No filters applied. Tap <strong>Add Filter</strong> to narrow your results.</p>
          </div>
        )}

        {/* ── Modal Footer ── */}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={handleClearClose}>Clear & Close</button>
          <button className="modal-confirm-btn" onClick={handleApply}>
            Apply Filters {filters.length > 0 && `(${filters.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
