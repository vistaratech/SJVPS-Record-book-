import { useCallback, memo, useState } from 'react';
import { Menu, Search, Plus, FileText, X, Folder, FileSpreadsheet, ClipboardPaste, Pencil, Trash2, History, PlusCircle, FolderPlus, User } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import type { RegisterSummary, Business } from '../../lib/api';
import { getRegister, listFolders, createFolder, renameFolder, deleteFolder, moveRegisterToFolder, duplicateRegister } from '../../lib/api';
interface SidebarProps {
  businesses?: Business[];
  filtered?: RegisterSummary[];
  search: string;
  setSearch: (v: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  menuId: number | null;
  setMenuId: (id: number | null) => void;
  onInputFolder?: () => void;
  onInputExcel?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importSession?: import('../../pages/HomePage').ImportSession | null;
  onClearImport?: () => void;
  clipboard: { id: number, type: 'move' | 'copy' } | null;
  setClipboard: (v: { id: number, type: 'move' | 'copy' } | null) => void;
  sidebarWidth?: number;
}

export const Sidebar = memo(function Sidebar({
  businesses,
  filtered,
  search,
  setSearch,
  sidebarOpen,
  setSidebarOpen,
  menuId,
  setMenuId,
  onInputFolder,
  onInputExcel,
  importSession,
  onClearImport,
  clipboard,
  setClipboard,
  sidebarWidth,
}: SidebarProps) {
  const navigate = useNavigate();
  const { id: currentRegId } = useParams();
  const queryClient = useQueryClient();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [folderMenuId, setFolderMenuId] = useState<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const businessId = businesses?.[0]?.id;

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', businessId],
    queryFn: () => listFolders(businessId!),
    enabled: !!businessId,
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(businessId!, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders', businessId] }),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameFolder(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders', businessId] }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => deleteFolder(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['folders', businessId], (old: any[] | undefined) => {
        return (old || []).filter(f => f.id !== deletedId);
      });
      queryClient.setQueryData(['registers', businessId], (old: RegisterSummary[] | undefined) => {
        return (old || []).map(r => r.folderId === deletedId ? { ...r, folderId: undefined } : r);
      });
      queryClient.invalidateQueries({ queryKey: ['folders', businessId] });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ regId, fId }: { regId: number; fId: number | null }) => moveRegisterToFolder(regId, fId),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['registers', businessId], (old: RegisterSummary[] | undefined) => {
        return (old || []).map(r => r.id === variables.regId ? { ...r, folderId: variables.fId === null ? undefined : variables.fId } : r);
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
    },
  });

  const handlePaste = async (folderId: number | null) => {
    if (!clipboard) return;
    if (clipboard.type === 'move') {
      await moveMutation.mutateAsync({ regId: clipboard.id, fId: folderId });
    } else if (clipboard.type === 'copy') {
      const newReg = await duplicateRegister(clipboard.id);
      await moveMutation.mutateAsync({ regId: newReg.id, fId: folderId });
    }
    setClipboard(null);
    setFolderMenuId(null);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim(), {
        onSuccess: () => {
          setIsCreatingFolder(false);
          setNewFolderName('');
        }
      });
    }
  };

  const prefetchRegister = useCallback((regId: number) => {
    queryClient.prefetchQuery({
      queryKey: ['register', regId],
      queryFn: () => getRegister(regId),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const renderRegister = (reg: RegisterSummary, indent: number = 0) => (
    <div
      key={reg.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', reg.id.toString());
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`register-item ${Number(currentRegId) === reg.id ? 'active' : ''}`}
      onClick={() => { navigate(`/register/${reg.id}`); closeSidebar(); }}
      onMouseEnter={() => prefetchRegister(reg.id)}
      style={indent ? { paddingLeft: `${16 + indent}px` } : undefined}
    >
      <div
        className="register-icon-bg"
        {...{ style: { '--dyn-bg': reg.iconColor ? `${reg.iconColor}20` : 'rgba(27,42,74,0.08)' } as React.CSSProperties }}
      >
        <FileText size={16} color={reg.iconColor || 'var(--navy)'} />
      </div>
      <div className="register-item-info">
        <div className="register-item-name">{reg.name}</div>
        <div className="register-item-meta">{reg.entryCount} entries • {new Date(reg.updatedAt).toLocaleDateString()}</div>
        {reg.lastActivity ? <div className="register-item-activity">{reg.lastActivity}</div> : null}
      </div>
      <button
        className="register-item-menu"
        title="Register options"
        aria-label="Register options"
        onClick={(e) => { e.stopPropagation(); setMenuId(menuId === reg.id ? null : reg.id); }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--muted)' }}
      >
        <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>⋮</span>
      </button>
    </div>
  );

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      
      {/* ── Folder Context Menu ── */}
      {folderMenuId !== null && (
        <div className="modal-overlay" onClick={() => setFolderMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">{folders.find(f => f.id === folderMenuId)?.name || 'Folder'}</div>
            <button className="context-item" onClick={() => {
              const name = prompt('Rename folder:', folders.find(f => f.id === folderMenuId)?.name || '');
              if (name && name.trim()) renameFolderMutation.mutate({ id: folderMenuId, name: name.trim() });
              setFolderMenuId(null);
            }}>
              <Pencil size={16} />Rename
            </button>
            <button 
              className="context-item" 
              onClick={() => handlePaste(folderMenuId)}
              disabled={!clipboard}
              style={{ opacity: !clipboard ? 0.5 : 1, cursor: !clipboard ? 'not-allowed' : 'pointer' }}
            >
              <ClipboardPaste size={16} />Paste {clipboard ? (clipboard.type === 'move' ? '(Move)' : '(Copy)') : ''}
            </button>
            <button className="context-item danger" onClick={() => {
              if (confirm('Delete this folder? Its registers will remain as unassigned.')) {
                deleteFolderMutation.mutate(folderMenuId);
              }
              setFolderMenuId(null);
            }}>
              <Trash2 size={16} />Delete
            </button>
          </div>
        </div>
      )}

      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="mobile-topbar-brand">
          <img src="/logo-transparent.png" alt="AG Trust" className="mobile-topbar-logo" />
          <span style={{ fontWeight: 700 }}>AG Trust</span>
        </div>
        <div style={{ width: 40 }} /> {/* Spacer for balance */}
      </div>

      {/* ── Sidebar ── */}
      <div
        className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}
        style={sidebarWidth ? { width: sidebarWidth, minWidth: sidebarWidth } : undefined}
      >
        {/* AG Trust Blue Header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-group" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-brand-name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo-transparent.png" alt="AG Trust" className="sidebar-brand-logo" />
              <span>AG Trust</span>
            </div>
            <div className="sidebar-brand-sub">Trusted Partners</div>
          </div>
        </div>

        {/* Sidebar Add Button */}
        <div className="sidebar-add-section" style={{ padding: '12px 12px 8px' }}>
          <button 
            className="sidebar-add-btn"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          >
            <Plus size={18} /> Add
          </button>

          {isAddMenuOpen && (
            <div 
              className="sidebar-add-dropdown"
              style={{
                marginTop: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            >
              <button className="context-item" style={{ padding: '10px 16px' }} onClick={() => { navigate('/templates'); setIsAddMenuOpen(false); }}>
                <PlusCircle size={16} color="var(--navy)" />New Register
              </button>
              <button className="context-item" style={{ padding: '10px 16px' }} onClick={() => { setIsCreatingFolder(true); setIsAddMenuOpen(false); }}>
                <FolderPlus size={16} color="var(--navy)" />New File
              </button>
              <label className="context-item" style={{ padding: '10px 16px', cursor: 'pointer' }}>
                <FileSpreadsheet size={16} color="#107c41" />Input Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden-file-input" onChange={(e) => { onInputExcel?.(e); setIsAddMenuOpen(false); }} />
              </label>
              <button className="context-item" style={{ padding: '10px 16px' }} onClick={() => { onInputFolder?.(); setIsAddMenuOpen(false); }}>
                <Folder size={16} fill="#fbbf24" color="#f59e0b" />Input File
              </button>
            </div>
          )}
        </div>

        {/* Folder creation input moved to a modal or handled via menu */}
        {isCreatingFolder && (
          <div className="sidebar-new-section" style={{ padding: '8px 20px' }}>
            <div className="sidebar-action-row" style={{ display: 'flex', gap: '4px' }}>
              <input 
                type="text" 
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                style={{ flex: 1, padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border)' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              />
              <button 
                onClick={handleCreateFolder}
                style={{ padding: '6px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
              <button 
                onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                style={{ padding: '6px', background: 'transparent', color: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        
        {importSession && (
          <div className="sidebar-import-session" style={{ margin: '0 1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Folder size={14} color="var(--primary)" />
                {importSession.folderName}
              </div>
              <button onClick={onClearImport} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px' }} aria-label="Clear import">
                <X size={14} />
              </button>
            </div>
            {importSession.files.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No excel files found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {importSession.files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: f.status === 'error' ? 'var(--danger)' : 'var(--muted)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span>
                      {f.status === 'waiting' && '⏳'}
                      {f.status === 'uploading' && <span className="spinner" style={{width: 10, height: 10, borderWidth: 2}}></span>}
                      {f.status === 'success' && '✅'}
                      {f.status === 'error' && '❌'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sidebar-list sidebar-list--local">
          {folders.map(folder => {
            const folderRegs = filtered?.filter(r => r.folderId === folder.id) || [];
            const isExpanded = expandedFolders[folder.id];

            return (
              <div key={folder.id} className="sidebar-folder-group">
                <div 
                  className="sidebar-folder-header"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.backgroundColor = 'rgba(30,45,120,0.05)';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.backgroundColor = 'transparent';
                    const regIdStr = e.dataTransfer.getData('text/plain');
                    if (regIdStr) {
                      moveMutation.mutate({ regId: parseInt(regIdStr, 10), fId: folder.id });
                    }
                  }}
                  onClick={() => setExpandedFolders(prev => ({...prev, [folder.id]: !prev[folder.id] ? true : false}))}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', gap: '8px', color: 'var(--navy)', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
                    {isExpanded ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    )}
                  </div>
                  <Folder size={16} color="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                  <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                  <button
                    className="register-item-menu"
                    onClick={(e) => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id); }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--muted)' }}
                  >
                    <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>⋮</span>
                  </button>
                </div>
                
                {isExpanded && (
                  <div className="sidebar-folder-children" style={{ paddingBottom: '4px' }}>
                    {folderRegs.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '4px 12px 4px 44px', fontStyle: 'italic' }}>Empty folder</div>
                    ) : (
                      folderRegs.map(reg => renderRegister(reg, 24))
                    )}
                  </div>
                )}
              </div>
            )
          })}
          
          <div 
            className="sidebar-unassigned-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const regIdStr = e.dataTransfer.getData('text/plain');
              if (regIdStr) {
                 moveMutation.mutate({ regId: parseInt(regIdStr, 10), fId: null });
              }
            }}
            style={{ paddingBottom: '20px', minHeight: '100px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unassigned</span>
              {clipboard && (
                <button 
                  onClick={() => handlePaste(null)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ClipboardPaste size={12} /> Paste Here
                </button>
              )}
            </div>
            {filtered?.filter(r => !r.folderId).map(reg => renderRegister(reg, 0))}
          </div>
        </div>

        {(isSearchOpen || search.length > 0) && (
          <div className="sidebar-search" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            <Search size={14} color="var(--muted)" />
            <input 
              autoFocus
              placeholder="Search register" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            {search && (
              <button 
                onClick={() => { setSearch(''); setIsSearchOpen(false); }} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: 'var(--muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div className="sidebar-footer" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo-transparent.png" alt="AG Trust" className="sidebar-footer-logo" style={{ margin: 0 }} />
            <span className="sidebar-footer-text">AG Trust · Record Book</span>
          </div>
          <button 
            onClick={() => setIsActionsMenuOpen(true)}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              width: '28px', height: '28px',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            aria-label="Actions menu"
          >
            <Menu size={14} />
          </button>
        </div>

        {/* ── Actions Menu ── */}
        {isActionsMenuOpen && (
          <>
            <div className="modal-overlay" style={{ background: 'transparent' }} onClick={() => setIsActionsMenuOpen(false)} />
            <div 
              className="context-menu" 
              onClick={(e) => e.stopPropagation()} 
              style={{ 
                position: 'absolute',
                bottom: '50px', 
                right: '12px', 
                zIndex: 1001,
                minWidth: '150px' 
              }}
            >
              <button className="context-item" onClick={() => { setIsActionsMenuOpen(false); navigate('/history'); }}>
                <History size={16} color="var(--navy)" />History
              </button>
              <button className="context-item" onClick={() => { setIsActionsMenuOpen(false); alert('Profile logic here'); }}>
                <User size={16} color="var(--navy)" />Profile
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
});
