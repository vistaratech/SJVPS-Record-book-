import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Download } from 'lucide-react';

interface RegisterHeaderProps {
  register: any;
  setShareModal: (v: boolean) => void;
  handleExportExcel: () => void;
}

export function RegisterHeader({ register, setShareModal, handleExportExcel }: RegisterHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="register-header">
      <button className="register-header-btn" aria-label="Go Back" title="Go Back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} />
      </button>
      <h1 className="register-header-title">{register.name}</h1>
      <button className="register-header-btn" onClick={() => setShareModal(true)}>
        <Share2 size={14} /> Share
      </button>
      <button className="register-header-btn" onClick={handleExportExcel}>
        <Download size={14} /> Export (Excel)
      </button>
    </div>
  );
}
