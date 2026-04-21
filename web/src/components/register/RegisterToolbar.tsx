import { Search, Filter, Plus, Trash2, Hash, FileText, Eye } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import type { Entry, Column } from '../../lib/api';

interface FilterState {
  columnId: number;
  operator: string;
  value: string;
}

interface RegisterToolbarProps {
  search: string;
  setSearch: (s: string) => void;
  activeFilters: FilterState[];
  setFilters: (f: FilterState[]) => void;
  setFilterModal: (v: boolean) => void;
  addEntryMutation: any; // React Query UseMutationResult
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
  displayEntries: Entry[];
  columns: Column[];
  bulkDeleteMutation: any; // React Query UseMutationResult
  setRowCountMutation?: any; // New mutation to bulk add/remove rows
}

export function RegisterToolbar({
  search, setSearch, activeFilters, setFilters, setFilterModal,
  addEntryMutation, setNewColName, setNewColType, setNewColDropdownOpts, setNewColFormula, setNewColumnModal,
  hiddenColumns, setHiddenColumns, registerId, hideColumn,
  selectedRows, displayEntries, columns, bulkDeleteMutation,
  setRowCountMutation
}: RegisterToolbarProps) {
  const [rowInput, setRowInput] = useState(displayEntries.length.toString());

  useEffect(() => {
    setRowInput(displayEntries.length.toString());
  }, [displayEntries.length]);

  const handleRowSubmit = () => {
    const val = parseInt(rowInput, 10);
    if (!isNaN(val) && val >= 0 && val !== displayEntries.length && setRowCountMutation) {
      setRowCountMutation.mutate(val);
    } else {
      setRowInput(displayEntries.length.toString());
    }
  };

  return (
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
        <span className="toolbar-stat" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Hash size={12} />
          <input 
            type="text" 
            inputMode="numeric"
            value={rowInput} 
            onChange={(e) => setRowInput(e.target.value.replace(/\D/g, ''))} 
            onBlur={handleRowSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleRowSubmit()}
            style={{ width: `${Math.max(1, rowInput.length)}ch`, background: 'transparent', border: 'none', color: 'inherit', outline: 'none', textAlign: 'center', fontWeight: 'inherit', fontSize: 'inherit', padding: 0 }}
          /> rows
        </span>
        <span className="toolbar-stat"><FileText size={12} />{columns.length} cols</span>
      </div>
    </div>
  );
}
