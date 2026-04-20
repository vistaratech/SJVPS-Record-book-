import { evaluateFormula, type Entry, type Column } from '../../lib/api';
import { Calendar, ChevronDown, Image as ImageIcon, Mail, Phone, Globe, MoreVertical } from 'lucide-react';
import React from 'react';

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
}

export const SpreadsheetRow = React.memo(function SpreadsheetRow({
  entry,
  idx,
  visibleColumns,
  isSelected,
  toggleSelectRow,
  handleCellChange,
  openDatePicker,
  openDropdown,
  isMenuOpen,
  toggleMenu,
  registerColumns,
}: SpreadsheetRowProps) {
  return (
    <tr>
      <td className="serial">
        <input 
          type="checkbox" 
          title="Select Row" 
          aria-label="Select Row" 
          checked={isSelected} 
          onChange={() => toggleSelectRow(entry.id)} 
        />
      </td>
      <td className="serial">{idx + 1}</td>
      {visibleColumns.map((col, colIdx) => (
        <td key={col.id}>
          {col.type === 'formula' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className={`cell-formula ${evaluateFormula(col.formula || '', entry, registerColumns) === 'ERR' ? 'error' : ''}`}>
              {evaluateFormula(col.formula || '', entry, registerColumns) || '–'}
            </div>
          ) : col.type === 'date' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-date" onClick={() => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '')} onKeyDown={(e) => { if (e.key === 'Enter') openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || ''); }}>
              {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><Calendar size={12} /> Select date</span>}
            </div>
          ) : col.type === 'dropdown' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={0} className="cell-dropdown" onClick={() => openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3'])} onKeyDown={(e) => { if (e.key === 'Enter') openDropdown(entry.id, col.id, col.dropdownOptions || ['Option 1', 'Option 2', 'Option 3']); }}>
              {entry.cells?.[col.id.toString()] || <span className="cell-placeholder"><ChevronDown size={12} /> Select</span>}
            </div>
          ) : col.type === 'checkbox' ? (
            <div className="cell-checkbox-wrap">
              <input
                id={`cell-${entry.id}-${col.id}`}
                type="checkbox"
                className="cell-checkbox"
                checked={entry.cells?.[col.id.toString()] === 'true'}
                onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.checked ? 'true' : 'false')}
                title={col.name}
              />
            </div>
          ) : col.type === 'rating' ? (
            <div data-cell={`cell-${idx}-${col.id}`} className="cell-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} className={`star-btn ${(parseInt(entry.cells?.[col.id.toString()] || '0') >= star) ? 'active' : ''}`} onClick={() => handleCellChange(entry.id, col.id.toString(), star.toString())} title={`Rate ${star}`}>★</button>
              ))}
            </div>
          ) : col.type === 'image' ? (
            <div data-cell={`cell-${idx}-${col.id}`} className="cell-image-wrap">
              {entry.cells?.[col.id.toString()] ? (
                <img src={entry.cells[col.id.toString()]} alt="img" className="cell-image-thumb" onClick={() => window.open(entry.cells[col.id.toString()], '_blank')} title="Open image" />
              ) : (
                <label className="cell-image-upload" title="Upload image">
                  <ImageIcon size={11} /> Add
                  <input type="file" accept="image/*" className="hidden-file-input" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => handleCellChange(entry.id, col.id.toString(), ev.target?.result as string); r.readAsDataURL(f); }} />
                </label>
              )}
            </div>
          ) : col.type === 'email' ? (
            <div className="cell-url-wrap">
              <input id={`cell-${idx}-${col.id}`} className="cell-input" value={entry.cells?.[col.id.toString()] || ''} onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)} placeholder="name@example.com" type="email" />
              {entry.cells?.[col.id.toString()] && <a href={`mailto:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Send email"><Mail size={11} /></a>}
            </div>
          ) : col.type === 'phone' ? (
            <div className="cell-url-wrap">
              <input id={`cell-${idx}-${col.id}`} className="cell-input" value={entry.cells?.[col.id.toString()] || ''} onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)} placeholder="+91 98765 43210" type="tel" />
              {entry.cells?.[col.id.toString()] && <a href={`tel:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Call"><Phone size={11} /></a>}
            </div>
          ) : col.type === 'url' ? (
            <div className="cell-url-wrap">
              <input id={`cell-${idx}-${col.id}`} className="cell-input" value={entry.cells?.[col.id.toString()] || ''} onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)} placeholder="https://..." type="url" />
              {entry.cells?.[col.id.toString()] && <a href={entry.cells[col.id.toString()]} target="_blank" rel="noreferrer" className="cell-url-link" title="Open"><Globe size={11} /></a>}
            </div>
          ) : (
            <input
              id={`cell-${idx}-${col.id}`}
              className="cell-input"
              value={entry.cells?.[col.id.toString()] || ''}
              onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const next = document.getElementById(`cell-${idx + 1}-${col.id}`);
                  if (next) next.focus();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prev = document.getElementById(`cell-${idx - 1}-${col.id}`);
                  if (prev) prev.focus();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const nextCol = visibleColumns[colIdx + 1];
                  if (nextCol) {
                    const next = document.getElementById(`cell-${idx}-${nextCol.id}`);
                    if (next) next.focus();
                  } else {
                    const firstCol = visibleColumns[0];
                    if (firstCol) {
                      const nextRow = document.getElementById(`cell-${idx + 1}-${firstCol.id}`);
                      if (nextRow) nextRow.focus();
                    }
                  }
                }
              }}
              type={col.type === 'number' ? 'number' : 'text'}
              placeholder={col.name}
            />
          )}
        </td>
      ))}
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
