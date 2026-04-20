import { Plus, X } from 'lucide-react';
import { type Column } from '../../../lib/api';

interface FilterModalProps {
  filterModal: boolean;
  setFilterModal: (v: boolean) => void;
  filters: Array<{ columnId: number; operator: string; value: string }>;
  setFilters: (v: Array<{ columnId: number; operator: string; value: string }>) => void;
  setActiveFilters: (v: Array<{ columnId: number; operator: string; value: string }>) => void;
  columns: Column[];
}

export function FilterModal({
  filterModal,
  setFilterModal,
  filters,
  setFilters,
  setActiveFilters,
  columns,
}: FilterModalProps) {
  if (!filterModal) return null;

  return (
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
            <select 
              className="modal-input filter-select" 
              aria-label="Filter Column" 
              title="Filter Column" 
              value={f.columnId} 
              onChange={(e) => { 
                const newF = [...filters]; 
                newF[idx].columnId = Number(e.target.value); 
                setFilters(newF); 
              }}
            >
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select 
              className="modal-input filter-operator" 
              aria-label="Filter Operator" 
              title="Filter Operator" 
              value={f.operator} 
              onChange={(e) => { 
                const newF = [...filters]; 
                newF[idx].operator = e.target.value; 
                setFilters(newF); 
              }}
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="gt">Greater than</option>
              <option value="lt">Less than</option>
              <option value="empty">Is empty</option>
              <option value="not_empty">Not empty</option>
            </select>
            {!['empty', 'not_empty'].includes(f.operator) && (
              <input 
                className="modal-input filter-value" 
                value={f.value} 
                onChange={(e) => { 
                  const newF = [...filters]; 
                  newF[idx].value = e.target.value; 
                  setFilters(newF); 
                }} 
                placeholder="Value" 
              />
            )}
            <button 
              className="remove-filter-btn" 
              aria-label="Remove Filter" 
              title="Remove Filter" 
              onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button 
          className="toolbar-btn add-filter-btn" 
          onClick={() => setFilters([...filters, { columnId: columns[0]?.id || 0, operator: 'contains', value: '' }])}
        >
          <Plus size={13} /> Add Filter
        </button>
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={() => { setActiveFilters([]); setFilterModal(false); }}>Clear & Close</button>
          <button className="modal-confirm-btn" onClick={() => { setActiveFilters(filters); setFilterModal(false); }}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
}
