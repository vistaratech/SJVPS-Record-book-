import { evaluateFormula, type Entry, type Column } from '../../lib/api';
import { Calendar, ChevronDown, Image as ImageIcon, Mail, Phone, Globe, MoreVertical } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Isolated memo component so formula evaluation only runs when its inputs change
const FormulaCell = React.memo(({ idx, col, entry, registerColumns }: {
  idx: number; col: Column; entry: Entry; registerColumns: Column[];
}) => {
  const result = evaluateFormula(col.formula || '', entry, registerColumns);
  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className={`cell-formula${result === 'ERR' ? ' error' : ''}`}
    >
      {result || '–'}
    </div>
  );
});

interface SpreadsheetTextInputProps {
  idx: number;
  col: Column;
  entry: Entry;
  visibleColumns: Column[];
  colIdx: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
}

const SpreadsheetTextInput = React.memo(({ idx, col, entry, visibleColumns, colIdx, handleCellChange }: SpreadsheetTextInputProps) => {
  const initialValue = entry.cells?.[col.id.toString()] || '';
  const [val, setVal] = useState(initialValue);

  // Sync if the entry is replaced (e.g., after add-row optimistic swap)
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setVal(newVal);
    // handleCellChange already debounces the server write; no local debounce needed
    handleCellChange(entry.id, col.id.toString(), newVal);
  }, [entry.id, col.id, handleCellChange]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter/Tab: Move left, wrap to previous row
        const prevCol = visibleColumns[colIdx - 1];
        if (prevCol) {
          focusNext(idx, prevCol.id);
        } else if (idx > 0) {
          const lastCol = visibleColumns[visibleColumns.length - 1];
          if (lastCol) focusNext(idx - 1, lastCol.id);
        }
      } else {
        // Enter/Tab: Move right, wrap to next row
        const nextCol = visibleColumns[colIdx + 1];
        if (nextCol) {
          focusNext(idx, nextCol.id);
        } else {
          const firstCol = visibleColumns[0];
          if (firstCol) focusNext(idx + 1, firstCol.id);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNext(idx + 1, col.id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNext(idx - 1, col.id);
    }
  }, [idx, col.id, visibleColumns, colIdx]);


  return (
    <input
      id={`cell-${idx}-${col.id}`}
      className="cell-input"
      value={val}
      onChange={onChange}
      onKeyDown={onKeyDown}
      type={col.type === 'number' ? 'number' : 'text'}
    />
  );
});

interface SpreadsheetRowProps {
  entry: Entry;
  idx: number;
  visibleColumns: Column[];
  isSelected: boolean;
  toggleSelectRow: (id: number) => void;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  openDatePicker: (entryId: number, colId: number, currentVal: string) => void;
  openDropdown: (entryId: number, colId: number, options: string[]) => void;
  isMenuOpen: boolean;
  toggleMenu: (id: number) => void;
  registerColumns: Column[];
  onRowDoubleClick?: (entry: Entry) => void;
}

export const SpreadsheetRow = React.memo(function SpreadsheetRow(props: SpreadsheetRowProps) {
  const {
    entry,
    idx,
    visibleColumns,
    handleCellChange,
    openDatePicker,
    openDropdown,
    toggleMenu,
    registerColumns,
    onRowDoubleClick,
  } = props;

  // Double-click detection on the serial (row number) cell
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, colId: number | string, colIdx: number) => {
    if (e.key === 'Escape') {
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        const prevCol = visibleColumns[colIdx - 1];
        if (prevCol) {
          focusNext(idx, prevCol.id);
        } else if (idx > 0) {
          const lastCol = visibleColumns[visibleColumns.length - 1];
          if (lastCol) focusNext(idx - 1, lastCol.id);
        }
      } else {
        const nextCol = visibleColumns[colIdx + 1];
        if (nextCol) {
          focusNext(idx, nextCol.id);
        } else {
          const firstCol = visibleColumns[0];
          if (firstCol) focusNext(idx + 1, firstCol.id);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNext(idx + 1, colId);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNext(idx - 1, colId);
    }
  }, [idx, visibleColumns]);

  const handleSerialClick = useCallback(() => {
    clickCountRef.current += 1;
    if (clickCountRef.current >= 2) {
      clickCountRef.current = 0;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      onRowDoubleClick?.(entry);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 400);
  }, [entry, onRowDoubleClick]);
  return (
    <tr onDoubleClick={() => onRowDoubleClick?.(entry)} title="Double-click row number to view all details">
      <td className="serial" style={{ cursor: 'pointer' }} onClick={handleSerialClick} title="Double-click to view details">{idx + 1}</td>
      {visibleColumns.map((col, colIdx) => {
        const cellVal = entry.cells?.[col.id.toString()] || '';
        const tdMinWidth = `${Math.max(6, cellVal.length + 2)}ch`;
        return (
        <td key={col.id} style={{ minWidth: tdMinWidth }}>
          {col.type === 'formula' ? (
            <FormulaCell idx={idx} col={col} entry={entry} registerColumns={registerColumns} />
          ) : col.type === 'date' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-date" onClick={() => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '')} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || ''); } else handleCellKeyDown(e, col.id, colIdx); }}>
              {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><Calendar size={12} /> Select date</span>}
            </div>
          ) : col.type === 'dropdown' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-dropdown" onClick={() => openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'])} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3']); } else handleCellKeyDown(e, col.id, colIdx); }}>
              {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><ChevronDown size={12} /> Select</span>}
            </div>
          ) : col.type === 'checkbox' ? (
            <div className="cell-checkbox-wrap">
              <input
                id={`cell-${idx}-${col.id}`}
                type="checkbox"
                className="cell-checkbox"
                checked={entry.cells?.[col.id.toString()] === 'true'}
                onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.checked ? 'true' : 'false')}
                onKeyDown={(e) => { if (e.key !== ' ') handleCellKeyDown(e, col.id, colIdx); }}
                title={col.name}
              />
            </div>
          ) : col.type === 'rating' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-rating" onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} className={`star-btn ${(parseInt(entry.cells?.[col.id.toString()] || '0') >= star) ? 'active' : ''}`} onClick={() => handleCellChange(entry.id, col.id.toString(), star.toString())} title={`Rate ${star}`} tabIndex={-1}>★</button>
              ))}
            </div>
          ) : col.type === 'image' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-image-wrap" onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}>
              {entry.cells?.[col.id.toString()] ? (
                <img src={entry.cells[col.id.toString()]} alt="img" className="cell-image-thumb" onClick={() => window.open(entry.cells[col.id.toString()], '_blank')} title="Open image" />
              ) : (
                <label className="cell-image-upload" title="Upload image">
                  <ImageIcon size={11} /> Add
                  <input type="file" accept="image/*" className="hidden-file-input" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => handleCellChange(entry.id, col.id.toString(), ev.target?.result as string); r.readAsDataURL(f); }} />
                </label>
              )}
            </div>
          ) : col.type === 'email' ? (
            <div className="cell-url-wrap">
              <input id={`cell-${idx}-${col.id}`} className="cell-input" value={entry.cells?.[col.id.toString()] || ''} onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} placeholder="name@example.com" type="email" />
              {entry.cells?.[col.id.toString()] && <a href={`mailto:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Send email" tabIndex={-1}><Mail size={11} /></a>}
            </div>
          ) : col.type === 'phone' ? (
            <div className="cell-url-wrap">
              <input id={`cell-${idx}-${col.id}`} className="cell-input" value={entry.cells?.[col.id.toString()] || ''} onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} placeholder="+91 98765 43210" type="tel" />
              {entry.cells?.[col.id.toString()] && <a href={`tel:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Call" tabIndex={-1}><Phone size={11} /></a>}
            </div>
          ) : col.type === 'url' ? (
            <div className="cell-url-wrap">
              <input id={`cell-${idx}-${col.id}`} className="cell-input" value={entry.cells?.[col.id.toString()] || ''} onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} placeholder="https://..." type="url" />
              {entry.cells?.[col.id.toString()] && <a href={entry.cells[col.id.toString()]} target="_blank" rel="noreferrer" className="cell-url-link" title="Open" tabIndex={-1}><Globe size={11} /></a>}
            </div>
          ) : (
            <SpreadsheetTextInput 
              idx={idx}
              col={col}
              entry={entry}
              visibleColumns={visibleColumns}
              colIdx={colIdx}
              handleCellChange={handleCellChange}
            />
          )}
        </td>
        );
      })}
      <td className="actions">
        <button 
          className="row-menu-btn" 
          aria-label="Row Options" 
          title="Row Options" 
          onClick={() => toggleMenu(entry.id)}
        >
          <MoreVertical size={14} />
        </button>
      </td>
    </tr>
  );
});
