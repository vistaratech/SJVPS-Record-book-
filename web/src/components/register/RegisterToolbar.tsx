import { Search, Filter, Plus, Trash2, Hash, FileText, Eye, X } from 'lucide-react';
import { useState, useEffect, memo, useRef } from 'react';
import type { Column } from '../../lib/api';

interface FilterState {
  columnId: number;
  operator: string;
  value: string;
  value2?: string;
}

interface RegisterToolbarProps {
  search: string;
  setSearch: (s: string) => void;
  activeFilters: FilterState[];
  setFilters: (f: FilterState[]) => void;
  setFilterModal: (v: boolean) => void;
  addEntryMutation: any;
  setNewColName: (v: string) => void;
  setNewColType: (v: string) => void;
  setNewColDropdownOpts: (v: string) => void;
  setNewColFormula: (v: string) => void;
  setNewColumnModal: (v: boolean) => void;
  hiddenColumns: Set<number>;
  setHiddenColumns: (v: Set<number>) => void;
  registerId: number;
  hideColumn: (registerId: number, colId: number, hidden: boolean) => void;
  selectedRows: Set<number>;
  rowCount: number;
  columns: Column[];
  bulkDeleteMutation: any;
  setRowCountMutation?: any;
}

export const RegisterToolbar = memo(function RegisterToolbar({
  search, setSearch, activeFilters, setFilters, setFilterModal,
  addEntryMutation, setNewColName, setNewColType, setNewColDropdownOpts, setNewColFormula, setNewColumnModal,
  hiddenColumns, setHiddenColumns, registerId, hideColumn,
  selectedRows, rowCount, columns, bulkDeleteMutation,
  setRowCountMutation
}: RegisterToolbarProps) {
  const [rowInput, setRowInput] = useState(rowCount.toString());
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRowInput(rowCount.toString());
  }, [rowCount]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [searchOpen, setSearch]);

  const handleRowSubmit = () => {
    const val = parseInt(rowInput, 10);
    if (!isNaN(val) && val >= 0 && val !== rowCount && setRowCountMutation) {
      setRowCountMutation.mutate(val);
    } else {
      setRowInput(rowCount.toString());
    }
  };

  return (
    <div className="register-toolbar">
      {/* Stats — left side */}
      <div className="toolbar-stats">
        <span className="toolbar-stat">
          <Hash size={11} />
          <input
            id="toolbar-row-input"
            type="text"
            inputMode="numeric"
            title="Row count"
            aria-label="Row count"
            placeholder="0"
            value={rowInput}
            onChange={(e) => setRowInput(e.target.value.replace(/\D/g, ''))}
            onBlur={handleRowSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleRowSubmit()}
            className="toolbar-row-input"
            style={{ width: `${Math.max(1, rowInput.length)}ch` }}
          />
          rows
        </span>
        <span className="toolbar-stat"><FileText size={11} />{columns.length} cols</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right-side action cluster */}
      <div className="toolbar-action-group">

        {/* Expandable search */}
        <div className={`toolbar-search-compact${searchOpen ? ' open' : ''}`}>
          {searchOpen && (
            <input
              ref={searchInputRef}
              className="toolbar-search-input"
              placeholder="Search rows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
            />
          )}
          <button
            className={`toolbar-icon-btn${search ? ' active' : ''}`}
            title={searchOpen ? 'Close search' : 'Search rows'}
            onClick={() => setSearchOpen(v => !v)}
            aria-label="Search"
          >
            {searchOpen && search ? <X size={14} /> : <Search size={14} />}
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Filter */}
        <button
          className={`toolbar-icon-btn${activeFilters.length > 0 ? ' active' : ''}`}
          title={`Filter${activeFilters.length > 0 ? ` (${activeFilters.length} active)` : ''}`}
          onClick={() => { setFilters(activeFilters.length ? [...activeFilters] : []); setFilterModal(true); }}
          aria-label="Filter"
        >
          <Filter size={14} />
          {activeFilters.length > 0 && <span className="toolbar-badge">{activeFilters.length}</span>}
        </button>

        {/* Show hidden */}
        {hiddenColumns.size > 0 && (
          <button
            className="toolbar-icon-btn active"
            title={`Show ${hiddenColumns.size} hidden columns`}
            onClick={() => { setHiddenColumns(new Set()); hiddenColumns.forEach((colId) => hideColumn(registerId, colId, false)); }}
            aria-label="Show hidden columns"
          >
            <Eye size={14} />
            <span className="toolbar-badge">{hiddenColumns.size}</span>
          </button>
        )}

        {/* Bulk delete */}
        {selectedRows.size > 0 && (
          <button
            className="toolbar-icon-btn danger"
            title={`Delete ${selectedRows.size} selected rows`}
            onClick={() => { if (confirm(`Delete ${selectedRows.size} selected rows?`)) bulkDeleteMutation.mutate(); }}
            aria-label="Delete selected"
          >
            <Trash2 size={14} />
            <span className="toolbar-badge">{selectedRows.size}</span>
          </button>
        )}

        <div className="toolbar-divider" />

        {/* Add Column */}
        <button
          className="toolbar-icon-btn"
          title="Add Column"
          onClick={() => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); setNewColumnModal(true); }}
          aria-label="Add Column"
        >
          <Plus size={14} />
          <span className="toolbar-icon-label">Col</span>
        </button>

        {/* Add Row — primary CTA */}
        <button
          className="toolbar-btn-primary"
          title="Add Row"
          onClick={() => addEntryMutation.mutate()}
          aria-label="Add Row"
        >
          <Plus size={13} />
          Add Row
        </button>
      </div>
    </div>
  );
});
