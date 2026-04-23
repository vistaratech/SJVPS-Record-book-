import { evaluateFormula, type Entry, type Column } from '../../lib/api';
import { Calendar, ChevronDown, Image as ImageIcon, Mail, Phone, Globe, ListOrdered, IndianRupee, Maximize2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

// Format number with Indian currency style: ₹1,23,456.00
function formatCurrency(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val || '';
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  // Indian grouping: last 3 digits, then every 2 digits
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining) formatted = remaining + ',' + formatted;
  }
  return `${n < 0 ? '-' : ''}₹${formatted}.${decPart}`;
}

// Isolated memo component so formula evaluation only runs when its inputs change
const FormulaCell = React.memo(({ idx, col, entry, registerColumns, onKeyDown }: {
  idx: number; col: Column; entry: Entry; registerColumns: Column[]; onKeyDown?: (e: React.KeyboardEvent) => void;
}) => {
  const result = evaluateFormula(col.formula || '', entry, registerColumns);
  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className={`cell-formula${result === 'ERR' ? ' error' : ''}`}
      onKeyDown={onKeyDown}
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
  totalRows: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
}

// Currency cell: shows ₹ formatted display, edits as raw number
const CurrencyCell = React.memo(({ idx, col, entry, colIdx, totalRows, visibleColumns, handleCellChange, onKeyDown }: SpreadsheetTextInputProps & { onKeyDown?: (e: React.KeyboardEvent) => void }) => {
  const rawValue = entry.cells?.[col.id.toString()] || '';
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(rawValue);

  useEffect(() => { setVal(rawValue); }, [rawValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') { 
      setEditing(false); 
      e.currentTarget.blur(); 
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setEditing(false);
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setEditing(false);
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id);
      }
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx - 1, col.id);
      }
    } else if (e.key === 'ArrowDown') {
      if (idx < totalRows - 1) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx + 1, col.id);
      }
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows]);

  if (editing) {
    return (
      <input
        id={`cell-${idx}-${col.id}`}
        className="cell-input currency-editing"
        type="number"
        value={val}
        autoFocus
        onChange={(e) => { setVal(e.target.value); handleCellChange(entry.id, col.id.toString(), e.target.value); }}
        onBlur={() => setEditing(false)}
        onKeyDown={handleKeyDown}
        placeholder="0.00"
      />
    );
  }

  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className="cell-currency"
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
      onKeyDown={onKeyDown}
      title="Click to edit"
    >
      {rawValue ? formatCurrency(rawValue) : <span className="cell-placeholder"><IndianRupee size={11} /> Amount</span>}
    </div>
  );
});

const SpreadsheetTextInput = React.memo(({ idx, col, entry, visibleColumns, colIdx, totalRows, handleCellChange }: SpreadsheetTextInputProps) => {
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
      if (idx < totalRows - 1) {
        e.preventDefault();
        focusNext(idx + 1, col.id);
      }
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        focusNext(idx - 1, col.id);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id);
      }
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows]);


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
  totalRows: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  openDatePicker: (entryId: number, colId: number, currentVal: string) => void;
  openDropdown: (entryId: number, colId: number, options: string[], rect?: DOMRect) => void;
  isMenuOpen: boolean;
  toggleMenu: (id: number) => void;
  registerColumns: Column[];
  onRowDetail?: (entry: Entry) => void;
  onImagePreview?: (src: string) => void;
  frozenColumns?: Set<number>;
}

export const SpreadsheetRow = React.memo(function SpreadsheetRow(props: SpreadsheetRowProps) {
  const {
    entry,
    idx,
    visibleColumns,
    totalRows,
    handleCellChange,
    openDatePicker,
    openDropdown,
    toggleMenu,
    registerColumns,
    onRowDetail,
    onImagePreview,
    frozenColumns,
  } = props;


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
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id);
      }
    }
  }, [idx, visibleColumns, totalRows]);

  const handleSerialClick = useCallback(() => {
    onRowDetail?.(entry);
  }, [entry, onRowDetail]);
  return (
    <tr>
      <td className="serial" style={{ cursor: 'pointer' }} onClick={handleSerialClick} title="Click to view details">{idx + 1}</td>
      {visibleColumns.map((col, colIdx) => {
        const isImage = col.type === 'image';
        const cellVal = entry.cells?.[col.id.toString()] || '';
        const tdMinWidth = isImage ? '100px' : `${Math.max(6, cellVal.length + 2)}ch`;
        
        // Frozen column sticky left for body cells
        const isFrozen = frozenColumns?.has(col.id);
        let frozenStyle: React.CSSProperties | undefined;
        if (isFrozen) {
          let left = 50; // S.No. column width
          for (const vc of visibleColumns) {
            if (vc.id === col.id) break;
            if (frozenColumns?.has(vc.id)) left += 120; // approx header width
          }
          frozenStyle = { position: 'sticky', left, zIndex: 5, background: '#fafbff', minWidth: tdMinWidth };
        }
        
        return (
        <td key={col.id} className={isFrozen ? 'frozen-col' : ''} style={frozenStyle || { minWidth: tdMinWidth }}>
          {col.type === 'formula' ? (
            <FormulaCell idx={idx} col={col} entry={entry} registerColumns={registerColumns} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} />
          ) : col.type === 'date' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-date" onClick={() => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '')} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || ''); } else handleCellKeyDown(e, col.id, colIdx); }}>
              {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><Calendar size={12} /> Select date</span>}
            </div>
          ) : col.type === 'dropdown' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-dropdown" onClick={(e) => openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'], e.currentTarget.getBoundingClientRect())} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'], e.currentTarget.getBoundingClientRect()); } else handleCellKeyDown(e, col.id, colIdx); }}>
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
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              tabIndex={0} 
              className="cell-image-wrap" 
              onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}
              onClick={() => {
                const val = entry.cells?.[col.id.toString()];
                if (val) onImagePreview?.(val);
              }}
              title={entry.cells?.[col.id.toString()] ? "Click to view full image" : "No image"}
            >
              {entry.cells?.[col.id.toString()] ? (
                <div className="cell-image-inner">
                  <img 
                    src={entry.cells[col.id.toString()]} 
                    alt="img" 
                    className="cell-image-thumb" 
                  />
                  <div className="cell-image-overlay">
                    <Maximize2 size={12} />
                  </div>
                </div>
              ) : (
                <label className="cell-image-upload" title="Upload image" onClick={(e) => e.stopPropagation()}>
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
          ) : col.type === 'auto_increment' ? (
            <div data-cell={`cell-${idx}-${col.id}`} className="cell-auto-increment" tabIndex={0} title="Auto-generated ID" onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}>
              <ListOrdered size={11} />
              <span>{entry.cells?.[col.id.toString()] || ''}</span>
            </div>
          ) : col.type === 'currency' ? (
            <CurrencyCell idx={idx} col={col} entry={entry} colIdx={colIdx} handleCellChange={handleCellChange} visibleColumns={visibleColumns} totalRows={totalRows} />
          ) : (
            <SpreadsheetTextInput 
              idx={idx}
              col={col}
              entry={entry}
              visibleColumns={visibleColumns}
              colIdx={colIdx}
              totalRows={totalRows}
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
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>⋮</span>
        </button>
      </td>
    </tr>
  );
});
