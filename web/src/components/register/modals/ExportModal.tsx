import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, FileText, FileDown, Type, List, CheckSquare, Square, Columns } from 'lucide-react';

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
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(4px)' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <div className="modal-header" style={{ padding: '24px 24px 16px', borderBottom: 'none' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-color)', marginBottom: '4px' }}>Export Data</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Configure how your register data should be downloaded.</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ alignSelf: 'flex-start', background: '#f5f5f5', borderRadius: '50%', padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '0 24px 24px' }}>
          
          {/* Format Selection */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <FileDown size={14} /> Export Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
              <button 
                onClick={() => setFormat('pdf')}
                style={{
                  padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px solid ${format === 'pdf' ? 'var(--primary)' : 'var(--border)'}`,
                  background: format === 'pdf' ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ padding: '10px', borderRadius: '10px', background: format === 'pdf' ? 'rgba(0,0,0,0.05)' : '#f5f5f5', color: format === 'pdf' ? 'var(--primary)' : 'var(--muted)' }}>
                  <FileText size={24} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: format === 'pdf' ? 'var(--primary)' : 'var(--text-color)', fontSize: '15px' }}>PDF Document</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Best for printing</div>
                </div>
              </button>
              
              <button 
                onClick={() => setFormat('excel')}
                style={{
                  padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px solid ${format === 'excel' ? 'var(--primary)' : 'var(--border)'}`,
                  background: format === 'excel' ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ padding: '10px', borderRadius: '10px', background: format === 'excel' ? 'rgba(0,0,0,0.05)' : '#f5f5f5', color: format === 'excel' ? 'var(--primary)' : 'var(--muted)' }}>
                  <FileSpreadsheet size={24} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: format === 'excel' ? 'var(--primary)' : 'var(--text-color)', fontSize: '15px' }}>Excel Sheet</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Best for editing</div>
                </div>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Page Settings */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Type size={14} /> Document Settings
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: includeHeading ? '#fafbff' : '#fff', transition: 'all 0.2s' }}>
                  {includeHeading ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} color="var(--muted)" />}
                  <input type="checkbox" checked={includeHeading} onChange={e => setIncludeHeading(e.target.checked)} style={{ display: 'none' }} />
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>Include Heading <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400, display: 'block' }}>{format === 'pdf' ? 'On every page' : 'At the top'}</span></div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: includeDateTime ? '#fafbff' : '#fff', transition: 'all 0.2s' }}>
                  {includeDateTime ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} color="var(--muted)" />}
                  <input type="checkbox" checked={includeDateTime} onChange={e => setIncludeDateTime(e.target.checked)} style={{ display: 'none' }} />
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>Date & Time <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400, display: 'block' }}>Printed on document</span></div>
                </label>
              </div>
            </div>

            {/* Row Selection */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <List size={14} /> Rows to Export
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: exportRows === 'all' ? '#fafbff' : '#fff', transition: 'all 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${exportRows === 'all' ? 'var(--primary)' : 'var(--muted)'}`, padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {exportRows === 'all' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
                  </div>
                  <input type="radio" name="exportRows" checked={exportRows === 'all'} onChange={() => setExportRows('all')} style={{ display: 'none' }} />
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>All Rows <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400, display: 'block' }}>{totalRowCount} total entries</span></div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: selectedRowCount === 0 ? 'not-allowed' : 'pointer', opacity: selectedRowCount === 0 ? 0.5 : 1, padding: '12px', border: '1px solid var(--border)', borderRadius: '10px', background: exportRows === 'selected' ? '#fafbff' : '#fff', transition: 'all 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${exportRows === 'selected' ? 'var(--primary)' : 'var(--muted)'}`, padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {exportRows === 'selected' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
                  </div>
                  <input type="radio" name="exportRows" disabled={selectedRowCount === 0} checked={exportRows === 'selected'} onChange={() => setExportRows('selected')} style={{ display: 'none' }} />
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>Selected Rows <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400, display: 'block' }}>{selectedRowCount} rows chosen</span></div>
                </label>
              </div>
            </div>
          </div>

          {/* Column Selection */}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Columns size={14} /> Columns to Export
              </label>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', background: '#e0e7ff', padding: '2px 8px', borderRadius: '12px' }}>
                {selectedColIds.size} / {columns.filter(c => c.type !== 'image').length} Selected
              </span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflowY: 'auto', maxHeight: '180px', background: '#fff', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              {columns.map(col => {
                if (col.type === 'image') return null; // Can't export images
                const isHidden = hiddenColumns.has(col.id);
                const isSelected = selectedColIds.has(col.id);
                return (
                  <label key={col.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', gap: '12px', background: isHidden ? '#f9fafb' : isSelected ? '#fafbff' : '#fff', transition: 'background 0.2s' }}>
                    {isSelected ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="var(--muted)" />}
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => toggleColumn(col.id)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? 500 : 400, color: isHidden ? 'var(--muted)' : 'var(--text-color)' }}>{col.name}</span>
                      {isHidden && <span style={{ fontSize: '11px', color: 'var(--muted)', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>Hidden in View</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}>Cancel</button>
          <button className="btn-primary" onClick={handleExportClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
            <FileDown size={18} /> Download {format === 'pdf' ? 'PDF' : 'Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
