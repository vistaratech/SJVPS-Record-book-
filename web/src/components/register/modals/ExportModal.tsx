import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, FileText, FileDown } from 'lucide-react';

export type ExportFormat = 'excel' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeHeading: boolean;
  includeDateTime: boolean;
  selectedColumnIds: Set<number>;
  exportRows: 'all' | 'selected';
}

interface ExportModalProps {
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  columns: any[];
  hiddenColumns: Set<number>;
  selectedRowCount: number;
  totalRowCount: number;
}

export function ExportModal({ onClose, onExport, columns, hiddenColumns, selectedRowCount, totalRowCount }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeHeading, setIncludeHeading] = useState(true);
  const [includeDateTime, setIncludeDateTime] = useState(true);
  const [exportRows, setExportRows] = useState<'all' | 'selected'>(selectedRowCount > 0 ? 'selected' : 'all');
  
  // Initialize with visible columns only
  const [selectedColIds, setSelectedColIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const visibleColIds = new Set<number>();
    columns.forEach(c => {
      if (!hiddenColumns.has(c.id) && c.type !== 'image') {
        visibleColIds.add(c.id);
      }
    });
    setSelectedColIds(visibleColIds);
  }, [columns, hiddenColumns]);

  const toggleColumn = (colId: number) => {
    const next = new Set(selectedColIds);
    if (next.has(colId)) next.delete(colId);
    else next.add(colId);
    setSelectedColIds(next);
  };

  const handleExportClick = () => {
    onExport({
      format,
      includeHeading,
      includeDateTime,
      selectedColumnIds: selectedColIds,
      exportRows,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>Export Options</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
          
          {/* Format Selection */}
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Export Format</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                className={`format-btn ${format === 'pdf' ? 'active' : ''}`}
                onClick={() => setFormat('pdf')}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${format === 'pdf' ? 'var(--primary)' : 'var(--border)'}`, background: format === 'pdf' ? '#f0fdf4' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <FileText size={24} color={format === 'pdf' ? 'var(--primary)' : 'var(--muted)'} />
                <span style={{ fontWeight: format === 'pdf' ? 600 : 400, color: format === 'pdf' ? 'var(--primary)' : 'inherit' }}>PDF Document</span>
              </button>
              <button 
                className={`format-btn ${format === 'excel' ? 'active' : ''}`}
                onClick={() => setFormat('excel')}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${format === 'excel' ? 'var(--primary)' : 'var(--border)'}`, background: format === 'excel' ? '#f0fdf4' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <FileSpreadsheet size={24} color={format === 'excel' ? 'var(--primary)' : 'var(--muted)'} />
                <span style={{ fontWeight: format === 'excel' ? 600 : 400, color: format === 'excel' ? 'var(--primary)' : 'inherit' }}>Excel Spreadsheet</span>
              </button>
            </div>
          </div>

          {/* Page Settings */}
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document Settings</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeHeading} onChange={e => setIncludeHeading(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                <span>Include Heading {format === 'pdf' && 'on every page'}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeDateTime} onChange={e => setIncludeDateTime(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                <span>Include Date & Time Stamp</span>
              </label>
            </div>
          </div>

          {/* Row Selection */}
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rows to Export</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="radio" name="exportRows" checked={exportRows === 'all'} onChange={() => setExportRows('all')} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                <span>All Rows ({totalRowCount})</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: selectedRowCount === 0 ? 'not-allowed' : 'pointer', opacity: selectedRowCount === 0 ? 0.5 : 1 }}>
                <input type="radio" name="exportRows" disabled={selectedRowCount === 0} checked={exportRows === 'selected'} onChange={() => setExportRows('selected')} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                <span>Selected Rows Only ({selectedRowCount})</span>
              </label>
            </div>
          </div>

          {/* Column Selection */}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Columns to Export</label>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{selectedColIds.size} selected</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflowY: 'auto', maxHeight: '200px', background: '#fafbff' }}>
              {columns.map(col => {
                if (col.type === 'image') return null; // Can't export images directly to raw cells easily
                const isHidden = hiddenColumns.has(col.id);
                return (
                  <label key={col.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', gap: '10px', background: isHidden ? '#f0f0f0' : '#fff' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedColIds.has(col.id)} 
                      onChange={() => toggleColumn(col.id)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ opacity: isHidden ? 0.6 : 1 }}>{col.name} {isHidden && '(Hidden)'}</span>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleExportClick} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileDown size={16} /> Export {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
