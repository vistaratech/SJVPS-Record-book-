import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBusinesses, listDeletedRegisters, restoreRegister, permanentlyDeleteRegister, type RegisterSummary } from '../lib/api';
import { Trash2, ArrowLeft, RefreshCw, XCircle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RecycleBinPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  const { data: deletedRegisters, isLoading } = useQuery({
    queryKey: ['deletedRegisters', businessId],
    queryFn: () => listDeletedRegisters(businessId!),
    enabled: !!businessId,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreRegister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedRegisters', businessId] });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
    },
  });

  const deletePermanentlyMutation = useMutation({
    mutationFn: permanentlyDeleteRegister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedRegisters', businessId] });
    },
  });

  const handleRestore = (id: number) => {
    restoreMutation.mutate(id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to permanently delete this register? This action cannot be undone.')) {
      deletePermanentlyMutation.mutate(id);
    }
  };

  return (
    <div className="recycle-bin-page">
      <div className="recycle-bin-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-title-group">
          <h1 className="header-title">Recycle Bin</h1>
          <p className="header-subtitle">Restore deleted registers or delete them permanently</p>
        </div>
      </div>

      <div className="recycle-bin-content">
        {isLoading ? (
          <div className="loading-state">Loading...</div>
        ) : !deletedRegisters || deletedRegisters.length === 0 ? (
          <div className="empty-state">
            <Trash2 size={48} className="empty-icon" />
            <p>Recycle bin is empty.</p>
          </div>
        ) : (
          <div className="deleted-items-grid">
            {deletedRegisters.map((reg: RegisterSummary) => (
              <div key={reg.id} className="deleted-item-card">
                <div className="item-icon" style={{ color: reg.iconColor || 'var(--navy)' }}>
                  <FileText size={24} />
                </div>
                <div className="item-details">
                  <h3>{reg.name}</h3>
                  <p>Deleted: {new Date(reg.deletedAt!).toLocaleDateString()}</p>
                  <p>{reg.entryCount} entries</p>
                </div>
                <div className="item-actions">
                  <button 
                    className="action-btn restore" 
                    onClick={() => handleRestore(reg.id)}
                    title="Restore Register"
                  >
                    <RefreshCw size={16} /> Restore
                  </button>
                  <button 
                    className="action-btn delete" 
                    onClick={() => handleDelete(reg.id)}
                    title="Delete Permanently"
                  >
                    <XCircle size={16} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .recycle-bin-page {
          flex: 1;
          background: #f8fafc;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .recycle-bin-header {
          background: white;
          padding: 24px 32px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 20px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .back-button {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: #64748b;
        }

        .back-button:hover {
          background: #f1f5f9;
          color: var(--navy);
          border-color: var(--navy);
        }

        .header-title-group .header-title {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .header-title-group .header-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 4px 0 0;
        }

        .recycle-bin-content {
          padding: 32px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .deleted-items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .deleted-item-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .item-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-details h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #1e293b;
        }

        .item-details p {
          margin: 0 0 4px 0;
          font-size: 13px;
          color: #64748b;
        }

        .item-actions {
          display: flex;
          gap: 12px;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }

        .action-btn.restore {
          background: #eff6ff;
          color: #2563eb;
        }

        .action-btn.restore:hover {
          background: #dbeafe;
        }

        .action-btn.delete {
          background: #fef2f2;
          color: #dc2626;
        }

        .action-btn.delete:hover {
          background: #fee2e2;
        }

        .loading-state, .empty-state {
          text-align: center;
          padding: 60px 0;
          color: #64748b;
        }

        .empty-icon {
          margin-bottom: 16px;
          opacity: 0.3;
        }
      `}</style>
    </div>
  );
}
