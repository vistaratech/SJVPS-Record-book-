import { useState, useRef, useEffect } from 'react';
import { Share2, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

interface RegisterHeaderProps {
  register: any;
  setShareModal: (v: boolean) => void;
  handleExportExcel: () => void;
  handleExportPDF: () => void;
}

export function RegisterHeader({ setShareModal, handleExportExcel, handleExportPDF }: RegisterHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  return (
    <div className="register-header-actions">
      <button className="register-header-btn" onClick={() => setShareModal(true)}>
        <Share2 size={14} /> Share
      </button>
      <div className="export-dropdown-wrap" ref={dropdownRef}>
        <button className="register-header-btn" onClick={() => setExportOpen(!exportOpen)}>
          <Download size={14} /> Download <ChevronDown size={12} style={{ marginLeft: 2, opacity: 0.7, transition: 'transform 0.2s', transform: exportOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
        </button>
        {exportOpen && (
          <div className="export-dropdown-menu">
            <button
              className="export-dropdown-item"
              onClick={() => { handleExportExcel(); setExportOpen(false); }}
            >
              <FileSpreadsheet size={16} />
              <div className="export-dropdown-item-info">
                <span className="export-dropdown-item-label">Excel (.xlsx)</span>
                <span className="export-dropdown-item-desc">Spreadsheet with formulas & dropdowns</span>
              </div>
            </button>
            <button
              className="export-dropdown-item"
              onClick={() => { handleExportPDF(); setExportOpen(false); }}
            >
              <FileText size={16} />
              <div className="export-dropdown-item-info">
                <span className="export-dropdown-item-label">PDF (.pdf)</span>
                <span className="export-dropdown-item-desc">Formatted table ready to print</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
