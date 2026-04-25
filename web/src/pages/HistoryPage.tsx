import { useQuery } from '@tanstack/react-query';
import { listBusinesses, listHistory, type HistoryEntry } from '../lib/api';
import { History, Calendar, User, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  const { data: history, isLoading } = useQuery({
    queryKey: ['history', businessId],
    queryFn: () => listHistory(businessId!),
    enabled: !!businessId,
  });

  return (
    <div className="history-page">
      <div className="history-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-title-group">
          <h1 className="header-title">History Log</h1>
          <p className="header-subtitle">Track all changes and modifications</p>
        </div>
      </div>

      <div className="history-content">
        {isLoading ? (
          <div className="loading-state">Loading history...</div>
        ) : !history || history.length === 0 ? (
          <div className="empty-state">
            <History size={48} className="empty-icon" />
            <p>No history entries found yet.</p>
          </div>
        ) : (
          <div className="history-timeline">
            {history.map((entry: HistoryEntry) => (
              <div key={entry.id} className="history-card">
                <div className="history-card-icon">
                  <div className="icon-circle">
                    {getActionIcon(entry.action)}
                  </div>
                  <div className="timeline-connector"></div>
                </div>
                <div className="history-card-main">
                  <div className="history-card-header">
                    <span className="action-badge">{entry.action}</span>
                    <span className="timestamp">
                      <Calendar size={12} />
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }).format(new Date(entry.timestamp))}
                    </span>
                  </div>
                  <p className="history-details">{entry.details}</p>
                  <div className="history-meta">
                    {entry.userName && (
                      <span className="meta-item">
                        <User size={12} />
                        {entry.userName}
                      </span>
                    )}
                    {entry.registerName && (
                      <span className="meta-item">
                        <FileText size={12} />
                        {entry.registerName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .history-page {
          flex: 1;
          background: #f8fafc;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .history-header {
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

        .history-content {
          padding: 32px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .history-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .history-card {
          display: flex;
          gap: 24px;
        }

        .history-card-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .icon-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: white;
          border: 2px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          z-index: 1;
        }

        .timeline-connector {
          flex: 1;
          width: 2px;
          background: #e2e8f0;
          margin: 4px 0;
        }

        .history-card:last-child .timeline-connector {
          display: none;
        }

        .history-card-main {
          flex: 1;
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .history-card-main:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .history-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .action-badge {
          background: #f1f5f9;
          color: #475569;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .timestamp {
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .history-details {
          font-size: 15px;
          color: #1e293b;
          line-height: 1.5;
          margin: 0 0 16px;
        }

        .history-meta {
          display: flex;
          gap: 16px;
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
        }

        .meta-item {
          font-size: 12px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
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

function getActionIcon(action: string) {
  const iconSize = 18;
  const a = action.toLowerCase();
  if (a.includes('create')) return <div style={{ color: '#10b981' }}><FileText size={iconSize} /></div>;
  if (a.includes('delete')) return <div style={{ color: '#ef4444' }}><Trash2 size={iconSize} /></div>;
  if (a.includes('rename')) return <div style={{ color: '#3b82f6' }}><Pencil size={iconSize} /></div>;
  if (a.includes('row')) return <div style={{ color: '#f59e0b' }}><FileText size={iconSize} /></div>;
  if (a.includes('column')) return <div style={{ color: '#8b5cf6' }}><FileText size={iconSize} /></div>;
  return <History size={iconSize} />;
}

import { Trash2, Pencil } from 'lucide-react';
