import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBusinesses, createBusiness, listRegisters, deleteRegister,
  renameRegister, duplicateRegister, importExcelData
} from '../lib/api';
import * as XLSX from 'xlsx';
import { CATEGORIES, TEMPLATES, type Template } from '../lib/templates';
import {
  Search, Plus, MoreVertical, FileText, Pencil, Copy, Trash2, X,
  Eye, Hash, Calendar, ChevronDown, FlaskConical, Type, Upload, Menu,
  Building, GraduationCap, Store, Bus, Warehouse, Package, CalendarIcon, HeartPulse,
  Utensils, Dumbbell, Building2, User, ShieldCheck, Leaf, Plane,
} from 'lucide-react';
import { createRegister } from '../lib/api';
import { Sidebar } from '../components/home/Sidebar';
import { DashboardContent } from '../components/home/DashboardContent';

const ICON_MAP: Record<string, any> = {
  'building': Building, 'graduation-cap': GraduationCap, 'store': Store, 'bus': Bus,
  'warehouse': Warehouse, 'package': Package, 'calendar': CalendarIcon, 'heart-pulse': HeartPulse,
  'utensils': Utensils, 'dumbbell': Dumbbell, 'building-2': Building2, 'user': User,
  'shield-check': ShieldCheck, 'leaf': Leaf, 'plane': Plane,
};

function getColTypeIcon(type: string) {
  switch (type) {
    case 'number': return <Hash size={10} />;
    case 'date': return <Calendar size={10} />;
    case 'dropdown': return <ChevronDown size={10} />;
    case 'formula': return <FlaskConical size={10} />;
    default: return <Type size={10} />;
  }
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  // Auto-create business
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
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRegister,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setMenuId(null); },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameRegister(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setRenameModal(false); },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateRegister,
    onSuccess: (newReg) => { queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setMenuId(null); navigate(`/register/${newReg.id}`); },
  });

  const excelMutation = useMutation({
    mutationFn: async ({ name, data }: { name: string; data: any[] }) => {
      const reg = await importExcelData(businessId!, name, data);
      return reg;
    },
    onSuccess: (newReg) => {
      // Immediately update the cache with the new register so home page shows it right away
      queryClient.setQueryData(['registers', businessId], (old: any[]) => {
        const existing = old || [];
        const alreadyExists = existing.find((r: any) => r.id === newReg.id);
        if (alreadyExists) return existing;
        return [...existing, { ...newReg, entryCount: newReg.entryCount || 0 }];
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      navigate(`/register/${newReg.id}`);
    },
    onError: (err: any) => alert(err.message),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const name = file.name.replace(/\.[^/.]+$/, "");
        excelMutation.mutate({ name, data });
      } catch (err) {
        alert("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const createMutation = useMutation({
    mutationFn: (template: Template) => {
      const categoryData = CATEGORIES.find((c) => c.id === selectedCategory);
      return createRegister({
        businessId: businessId!, name: template.name, icon: template.icon,
        iconColor: categoryData?.color, category: categoryData?.name || 'general',
        template: template.name,
        columns: template.columns.map((c) => ({ name: c.name, type: c.type, dropdownOptions: c.dropdownOptions, formula: c.formula })),
      });
    },
    onSuccess: (newReg) => {
      queryClient.setQueryData(['registers', businessId], (old: any[]) => {
        const existing = old || [];
        const alreadyExists = existing.find((r: any) => r.id === newReg.id);
        if (alreadyExists) return existing;
        return [...existing, { ...newReg, entryCount: newReg.entryCount || 0 }];
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setCreatingTemplate(null); setSelectedCategory(null);
      navigate(`/register/${newReg.id}`);
    },
    onError: () => setCreatingTemplate(null),
  });

  const filtered = registers?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const categoryData = CATEGORIES.find((c) => c.id === selectedCategory);
  const subTemplates = selectedCategory ? TEMPLATES[selectedCategory] || [] : [];

  return (
    <div className="app-layout">
      <Sidebar 
        businesses={businesses}
        filtered={filtered}
        search={search}
        setSearch={setSearch}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        menuId={menuId}
        setMenuId={setMenuId}
      />

      <DashboardContent 
        filtered={filtered}
        excelMutation={excelMutation}
        handleFileUpload={handleFileUpload}
      />

      {/* ── Context Menu ── */}
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
            <button className="context-item danger" onClick={() => {
              if (confirm('Delete this register? This cannot be undone.')) deleteMutation.mutate(menuId);
            }}>
              <Trash2 size={16} />Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Rename Modal ── */}
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

      {/* ── Template Category Modal ── */}
      {selectedCategory && (
        <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
          <div className="modal-content modal-content--wide" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header" {...{ style: { '--dyn-bg': categoryData?.color || 'var(--navy)' } as React.CSSProperties }}>
              <div className="template-modal-header-icon">
                {(() => { const Icon = ICON_MAP[categoryData?.icon || ''] || FileText; return <Icon size={24} />; })()}
              </div>
              <div>
                <div className="template-modal-header-title">{categoryData?.name} Templates</div>
                <div className="template-modal-header-sub">Choose a layout to get started</div>
              </div>
              <button
                className="template-modal-close"
                title="Close"
                aria-label="Close template picker"
                onClick={() => setSelectedCategory(null)}
              >
                <X size={20} />
              </button>
            </div>

            {subTemplates.map((tpl, idx) => (
              <div key={idx} className="tpl-card">
                <div className="tpl-card-header">
                  <FileText size={22} color={categoryData?.color || 'var(--navy)'} />
                  <div>
                    <div className="tpl-name">{tpl.name}</div>
                    <div className="tpl-desc">{tpl.description}</div>
                  </div>
                </div>
                {tpl.columns.length > 0 && (
                  <div className="tpl-chips">
                    {tpl.columns.slice(0, 5).map((col, i) => (
                      <span key={i} className="tpl-chip">{getColTypeIcon(col.type)} {col.name}</span>
                    ))}
                    {tpl.columns.length > 5 && <span className="tpl-chip">+{tpl.columns.length - 5} more</span>}
                  </div>
                )}
                <button className="tpl-use-btn" onClick={() => { setCreatingTemplate(tpl.name); createMutation.mutate(tpl); }} disabled={!!creatingTemplate}>
                  {creatingTemplate === tpl.name ? <div className="spinner" /> : <><Eye size={14} />Preview & Use</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
