import { evaluateFormula, type Entry, type Column } from '../../lib/api';
import { Calendar, ChevronDown, Image as ImageIcon, Mail, Phone, Globe, ListOrdered, IndianRupee } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

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

  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing && divRef.current) {
      divRef.current.focus();
    }
  }, [editing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') { 
      e.preventDefault();
      setEditing(false); 
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'Tab') {
      e.preventDefault();
      setEditing(false);
      setTimeout(() => {
        if (e.shiftKey) {
          const prevCol = visibleColumns[colIdx - 1];
          if (prevCol) focusNext(idx, prevCol.id);
          else if (idx > 0) focusNext(idx - 1, visibleColumns[visibleColumns.length - 1]?.id);
        } else {
          const nextCol = visibleColumns[colIdx + 1];
          if (nextCol) focusNext(idx, nextCol.id);
          else focusNext(idx + 1, visibleColumns[0]?.id);
        }
      }, 0);
      return;
    }

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
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (val !== rawValue) {
            handleCellChange(entry.id, col.id.toString(), val);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="0.00"
      />
    );
  }

  return (
    <div
      ref={divRef}
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className="cell-currency"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setEditing(true);
        } else {
          onKeyDown?.(e);
        }
      }}
      title="Click or press Enter to edit"
    >
      {rawValue ? formatCurrency(rawValue) : <span className="cell-placeholder"><IndianRupee size={11} /> Amount</span>}
    </div>
  );
});

const SpreadsheetTextInput = React.memo(({ idx, col, entry, visibleColumns, colIdx, totalRows, handleCellChange, onKeyDown }: SpreadsheetTextInputProps & { onKeyDown?: (e: React.KeyboardEvent) => void }) => {
  const initialValue = entry.cells?.[col.id.toString()] || '';
  const [val, setVal] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!editing && divRef.current) {
      divRef.current.focus();
    }
  }, [editing]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value);
  }, []);

  const onCommit = useCallback(() => {
    setEditing(false);
    if (val !== initialValue) {
      handleCellChange(entry.id, col.id.toString(), val);
    }
  }, [entry.id, col.id, handleCellChange, val, initialValue]);

  const onInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      onCommit();
      return;
    }

    const focusNext = (rowI: number, cId: number | string) => {
      const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
      if (el) el.focus();
    };

    if (e.key === 'Tab') {
      e.preventDefault();
      onCommit();
      setTimeout(() => {
        if (e.shiftKey) {
          const prevCol = visibleColumns[colIdx - 1];
          if (prevCol) focusNext(idx, prevCol.id);
          else if (idx > 0) focusNext(idx - 1, visibleColumns[visibleColumns.length - 1]?.id);
        } else {
          const nextCol = visibleColumns[colIdx + 1];
          if (nextCol) focusNext(idx, nextCol.id);
          else focusNext(idx + 1, visibleColumns[0]?.id);
        }
      }, 0);
    } else if (e.key === 'ArrowDown') {
      if (idx < totalRows - 1) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx + 1, col.id);
      }
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx - 1, col.id);
      }
    } else if (e.key === 'ArrowLeft') {
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
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows]);


  if (editing) {
    const inputType = col.type === 'number' ? 'number' : 
                     (col.type === 'email' ? 'email' : 
                     (col.type === 'phone' ? 'tel' : 
                     (col.type === 'url' ? 'url' : 'text')));
    
    return (
      <input
        id={`cell-${idx}-${col.id}`}
        className="cell-input"
        value={val}
        onChange={onChange}
        onKeyDown={onInputKeyDown}
        onBlur={onCommit}
        autoFocus
        type={inputType}
        placeholder={col.type === 'email' ? 'name@example.com' : (col.type === 'phone' ? '+91...' : (col.type === 'url' ? 'https://...' : ''))}
      />
    );
  }

  const renderIcon = () => {
    if (!val) return null;
    if (col.type === 'email') return <a href={`mailto:${val}`} className="cell-url-link" title="Send email" tabIndex={-1}><Mail size={11} /></a>;
    if (col.type === 'phone') return <a href={`tel:${val}`} className="cell-url-link" title="Call" tabIndex={-1}><Phone size={11} /></a>;
    if (col.type === 'url') return <a href={val} target="_blank" rel="noreferrer" className="cell-url-link" title="Open" tabIndex={-1}><Globe size={11} /></a>;
    return null;
  };

  return (
    <div
      ref={divRef}
      id={`cell-${idx}-${col.id}`}
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className={`cell-input cell-text-display ${col.type === 'email' || col.type === 'phone' || col.type === 'url' ? 'cell-url-wrap' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setEditing(true);
        } else {
          onKeyDown?.(e);
        }
      }}
      onClick={() => setEditing(true)}
      style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', justifyContent: 'space-between' }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
      {renderIcon()}
    </div>
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
  onRowDoubleClick?: (entry: Entry) => void;
  frozenColumns?: Set<number>;
  columnOffsets: Record<number, number>;
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
    onRowDoubleClick,
    frozenColumns,
    columnOffsets,
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

    if (e.key === 'Tab') {
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
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Enter now handled by individual cells to trigger edit mode
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
        
        const offset = columnOffsets[col.id];
        const isFrozen = offset !== undefined;
        const frozenStyle: React.CSSProperties | undefined = isFrozen 
          ? { position: 'sticky', left: offset, zIndex: 5, background: '#fafbff', minWidth: tdMinWidth } 
          : { minWidth: tdMinWidth };
        
        return (
          <td key={col.id} className={isFrozen ? 'frozen-col' : ''} style={frozenStyle}>
            {col.type === 'formula' ? (
              <FormulaCell 
                idx={idx} 
                col={col} 
                entry={entry} 
                registerColumns={registerColumns} 
                onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} 
              />
            ) : col.type === 'date' ? (
              <div 
                data-cell={`cell-${idx}-${col.id}`} 
                tabIndex={0} 
                className="cell-date" 
                onClick={() => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '')} 
                onKeyDown={(e) => { 
                  if (e.key === ' ' || e.key === 'Enter') { 
                    e.preventDefault(); 
                    openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || ''); 
                  } else {
                    handleCellKeyDown(e, col.id, colIdx); 
                  }
                }}
              >
                {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><Calendar size={12} /> Select date</span>}
              </div>
            ) : col.type === 'dropdown' ? (
              <div 
                data-cell={`cell-${idx}-${col.id}`} 
                tabIndex={0} 
                className="cell-dropdown" 
                onClick={(e) => openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'], e.currentTarget.getBoundingClientRect())} 
                onKeyDown={(e) => { 
                  if (e.key === ' ' || e.key === 'Enter') { 
                    e.preventDefault(); 
                    openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'], e.currentTarget.getBoundingClientRect()); 
                  } else {
                    handleCellKeyDown(e, col.id, colIdx); 
                  }
                }}
              >
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
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCellChange(entry.id, col.id.toString(), entry.cells?.[col.id.toString()] === 'true' ? 'false' : 'true');
                    } else if (e.key !== ' ') {
                      handleCellKeyDown(e, col.id, colIdx); 
                    }
                  }}
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
                    <input type="file" accept="image/*" className="hidden-file-input" tabIndex={-1} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => handleCellChange(entry.id, col.id.toString(), ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                )}
              </div>
            ) : col.type === 'auto_increment' ? (
              <div data-cell={`cell-${idx}-${col.id}`} className="cell-auto-increment" tabIndex={0} title="Auto-generated ID" onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}>
                <ListOrdered size={11} />
                <span>{entry.cells?.[col.id.toString()] || ''}</span>
              </div>
            ) : col.type === 'currency' ? (
              <CurrencyCell idx={idx} col={col} entry={entry} colIdx={colIdx} handleCellChange={handleCellChange} visibleColumns={visibleColumns} totalRows={totalRows} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} />
            ) : (
              <SpreadsheetTextInput 
                idx={idx}
                col={col}
                entry={entry}
                visibleColumns={visibleColumns}
                colIdx={colIdx}
                totalRows={totalRows}
                handleCellChange={handleCellChange}
                onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}
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
