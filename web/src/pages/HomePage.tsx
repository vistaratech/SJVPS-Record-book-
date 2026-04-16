import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBusinesses, createBusiness, listRegisters, deleteRegister,
  renameRegister, duplicateRegister,
} from '../lib/api';
import { CATEGORIES, TEMPLATES, type Template } from '../lib/templates';
import {
  Search, Plus, MoreVertical, FileText, Pencil, Copy, Trash2, ExternalLink, X,
  Eye, Hash, Calendar, ChevronDown, FlaskConical, Type,
  Building, GraduationCap, Store, Bus, Warehouse, Package, CalendarIcon, HeartPulse,
  Utensils, Dumbbell, Building2, User, ShieldCheck, Leaf, Plane,
} from 'lucide-react';
import { createRegister } from '../lib/api';

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
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRegister,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers'] }); setMenuId(null); },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameRegister(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers'] }); setRenameModal(false); },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateRegister,
    onSuccess: (newReg) => { queryClient.invalidateQueries({ queryKey: ['registers'] }); setMenuId(null); navigate(`/register/${newReg.id}`); },
  });

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
      queryClient.invalidateQueries({ queryKey: ['registers'] });
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
      {/* ── Sidebar ── */}
      <div className="sidebar">
        {/* Brand Strip — deep green, school logo */}
        <div className="sidebar-brand">
          <img src="/logo-transparent.png" alt="SJVPS" className="sidebar-brand-logo" />
          <div>
            <div className="sidebar-brand-name">SJVPS Record Book</div>
            <div className="sidebar-brand-sub">Learn and Grow</div>
          </div>
        </div>

        <div className="sidebar-header">
          <div className="sidebar-business">
            <div className="sidebar-avatar">{businesses?.[0]?.name?.[0] || 'B'}</div>
            <span className="sidebar-bname">{businesses?.[0]?.name || 'My Business'}</span>
          </div>
        </div>

        <div className="sidebar-search">
          <Search size={14} color="var(--muted)" />
          <input placeholder="Search register" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <button className="sidebar-add-btn" onClick={() => navigate('/templates')}>
          <Plus size={14} />Add New Register
        </button>

        <div className="sidebar-list">
          {filtered?.map((reg) => (
            <div
              key={reg.id}
              className="register-item"
              onClick={() => navigate(`/register/${reg.id}`)}
            >
              <div
                className="register-icon-bg"
                style={{ backgroundColor: reg.iconColor ? `${reg.iconColor}20` : 'rgba(27,42,74,0.08)' }}
              >
                <FileText size={16} color={reg.iconColor || 'var(--navy)'} />
              </div>
              <div className="register-item-info">
                <div className="register-item-name">{reg.name}</div>
                <div className="register-item-meta">{reg.entryCount} entries • {reg.category}</div>
              </div>
              <button
                className="register-item-menu"
                title="Register options"
                aria-label="Register options"
                onClick={(e) => { e.stopPropagation(); setMenuId(menuId === reg.id ? null : reg.id); }}
              >
                <MoreVertical size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <img src="/logo-transparent.png" alt="SJVPS" className="sidebar-footer-logo" />
          <span className="sidebar-footer-text">SJVPS · CBSE Affiliated</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="content-area">
        {!filtered || filtered.length === 0 ? (
          <div className="empty-state">
            <img src="/logo-transparent.png" alt="SJVPS" className="empty-logo" />
            <h2 className="empty-title">Welcome to SJVPS Record Book</h2>
            <p className="empty-sub">Create your first register by selecting a template or start from scratch.</p>
            <button className="empty-btn" onClick={() => navigate('/templates')}>
              <Plus size={16} />Add New Register
            </button>
          </div>
        ) : (
          <div className="registers-content">
            <h2 className="registers-heading">Your Registers</h2>
            <p className="registers-subheading">
              {filtered.length} register{filtered.length !== 1 ? 's' : ''} &bull; Click to open
            </p>
            <div className="categories-grid categories-grid--no-pad">
              {filtered.map((reg) => (
                <div key={reg.id} className="category-card" onClick={() => navigate(`/register/${reg.id}`)}>
                  <div className="category-icon" style={{ background: reg.iconColor || 'var(--navy)' }}>
                    <FileText size={24} />
                  </div>
                  <div className="category-name">{reg.name}</div>
                  <div className="category-count">{reg.entryCount} entries &bull; {reg.category}</div>
                </div>
              ))}
              <div className="category-card category-card--dashed" onClick={() => navigate('/templates')}>
                <div className="category-icon category-icon--muted">
                  <Plus size={24} />
                </div>
                <div className="category-name">Add New</div>
                <div className="category-count">Create from template</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Context Menu ── */}
      {menuId !== null && (
        <div className="modal-overlay" onClick={() => setMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">{filtered?.find((r) => r.id === menuId)?.name || 'Register'}</div>
            <button className="context-item" onClick={() => { navigate(`/register/${menuId}`); setMenuId(null); }}>
              <ExternalLink size={16} />Open Register
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
            <div className="template-modal-header" style={{ background: categoryData?.color || 'var(--navy)' }}>
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
