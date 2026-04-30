import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBusinesses, createBusiness, listRegisters, deleteRegister,
  renameRegister, duplicateRegister, importExcelData,
  type RegisterSummary,
} from '../lib/api';
import * as XLSX from 'xlsx';
import { importLocalFolderToCloud } from '../lib/localFs';
import { Pencil, Copy, Trash2, Eye, Scissors } from 'lucide-react';
import { DashboardContent } from '../components/home/DashboardContent';
import { Sidebar } from '../components/home/Sidebar';
import RegisterPage from './RegisterPage';
import TemplatesPage from './TemplatesPage';
import HistoryPage from './HistoryPage';
import RecycleBinPage from './RecycleBinPage';

const RegisterPageWrapper = memo(() => {
  const { id } = useParams();
  return <RegisterPage key={id} />;
});


export interface ImportSession {
  folderName: string;
  files: { name: string; status: 'waiting' | 'uploading' | 'success' | 'error' }[];
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [clipboard, setClipboard] = useState<{ id: number, type: 'move' | 'copy' } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  // ── Resizable sidebar ──
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 480;
  const SIDEBAR_DEFAULT = 260;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, parsed)) : SIDEBAR_DEFAULT;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - dragStartX.current;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Persist to localStorage
      setSidebarWidth((w) => { localStorage.setItem('sidebar-width', String(w)); return w; });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  useEffect(() => {
    if (businesses && businesses.length === 0) {
      createBusiness('My Business').then(() => queryClient.invalidateQueries({ queryKey: ['businesses'] }));
    }
  }, [businesses, queryClient]);

  const { data: registers } = useQuery({
    queryKey: ['registers', businessId],
    queryFn: () => listRegisters(businessId!),
    enabled: !!businessId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRegister,
    onSuccess: (_, deletedId) => { 
      queryClient.setQueryData(['registers', businessId], (old: import('../lib/api').RegisterSummary[] | undefined) => {
        return (old || []).filter(r => r.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); 
      queryClient.invalidateQueries({ queryKey: ['deletedRegisters', businessId] }); 
      setMenuId(null); 
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameRegister(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setRenameModal(false); },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateRegister,
    onSuccess: (newReg) => {
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setMenuId(null);
      navigate(`/register/${newReg.id}`);
    },
  });

  const excelMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Record<string, string>[] }) => importExcelData(businessId!, name, data),
    onSuccess: (newReg) => {
      queryClient.setQueryData(['registers', businessId], (old: RegisterSummary[] | undefined) => {
        const safeOld = old || [];
        if (safeOld.find((r: RegisterSummary) => r.id === newReg.id)) return safeOld;
        return [...safeOld, { ...newReg, entryCount: newReg.entryCount || 0 }];
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
        excelMutation.mutate({ name: file.name.replace(/\.[^/.]+$/, ''), data }, {
          onSuccess: (newReg) => navigate(`/register/${newReg.id}`)
        });
      } catch {
        alert('Failed to parse Excel file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, [excelMutation, navigate]);

  const handleFolderUpload = useCallback(async () => {
    if (!businessId) return;
    try {
      const result = await importLocalFolderToCloud();
      if (!result || result.files.length === 0) return;
      
      const { folderName, files } = result;
      setImportSession({
        folderName,
        files: files.map(f => ({ name: f.name, status: 'waiting' }))
      });
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setImportSession(prev => prev ? {
          ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f)
        } : null);

        try {
          await excelMutation.mutateAsync({ name: file.name, data: file.data });
          setImportSession(prev => prev ? {
            ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: 'success' } : f)
          } : null);
        } catch (e) {
          console.error(`Failed to import ${file.name}`, e);
          setImportSession(prev => prev ? {
            ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: 'error' } : f)
          } : null);
        }
      }
      
    } catch (e) {
      console.error(e);
      alert('An error occurred during import.');
    }
  }, [businessId, excelMutation]);

  const filtered = useMemo(() => 
    registers?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [registers, search]
  );

  return (
    <div className="app-layout">
      <Sidebar
        importSession={importSession}
        onClearImport={() => setImportSession(null)}
        businesses={businesses}
        filtered={filtered}
        search={search}
        setSearch={setSearch}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        menuId={menuId}
        setMenuId={setMenuId}
        onInputFolder={handleFolderUpload}
        onInputExcel={handleFileUpload}
        clipboard={clipboard}
        setClipboard={setClipboard}
        sidebarWidth={sidebarWidth}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => {
          setIsSidebarCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
          });
        }}
      />

      {/* ── Draggable resize handle ── */}
      {!isSidebarCollapsed && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={onResizeStart}
          onDoubleClick={() => { setSidebarWidth(SIDEBAR_DEFAULT); localStorage.setItem('sidebar-width', String(SIDEBAR_DEFAULT)); }}
          title="Drag to resize sidebar · Double-click to reset"
        />
      )}

      <Routes>
        <Route index element={
          <DashboardContent
            filtered={filtered}
            excelMutation={excelMutation}
            handleFileUpload={handleFileUpload}
            onInputFolder={handleFolderUpload}
          />
        } />
        <Route path="register/:id" element={<RegisterPageWrapper />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/:categoryId" element={<TemplatesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="recycle-bin" element={<RecycleBinPage />} />
      </Routes>

      {/* ── Register Context Menu ── */}
      {menuId !== null && (
        <div className="modal-overlay" onClick={() => setMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">{filtered?.find((r) => r.id === menuId)?.name || 'Register'}</div>
            <button className="context-item" onClick={() => { navigate(`/register/${menuId}`); setMenuId(null); }}>
              <Eye size={16} />Open Register
            </button>
            <button className="context-item" onClick={() => {
              const reg = filtered?.find((r) => r.id === menuId);
              setRenameId(menuId); setRenameValue(reg?.name || ''); setMenuId(null); setRenameModal(true);
            }}>
              <Pencil size={16} />Rename
            </button>
            <button className="context-item" onClick={() => duplicateMutation.mutate(menuId)}>
              <Copy size={16} />Duplicate
            </button>
            <button className="context-item" onClick={() => { setClipboard({ id: menuId, type: 'copy' }); setMenuId(null); }}>
              <Copy size={16} />Copy
            </button>
            <button className="context-item" onClick={() => { setClipboard({ id: menuId, type: 'move' }); setMenuId(null); }}>
              <Scissors size={16} />Move
            </button>
            <button className="context-item danger" onClick={() => {
              if (confirm('Delete this register? This cannot be undone.')) deleteMutation.mutate(menuId);
            }}>
              <Trash2 size={16} />Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Register Rename Modal ── */}
      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Register</h3>
            <input
              className="modal-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Register name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && renameId && renameValue.trim() && renameMutation.mutate({ id: renameId, name: renameValue.trim() })}
            />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setRenameModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!renameValue.trim()} onClick={() => renameId && renameMutation.mutate({ id: renameId, name: renameValue.trim() })}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
