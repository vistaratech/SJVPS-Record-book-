import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { listBusinesses, createBusiness, createRegister } from '../lib/api';
import { CATEGORIES, TEMPLATES, type Template } from '../lib/templates';
import {
  ArrowLeft, FileText, Eye, X, Hash, Calendar, ChevronDown, FlaskConical, Type,
  Building, GraduationCap, Store, Bus, Warehouse, Package, CalendarIcon, HeartPulse,
  Utensils, Dumbbell, Building2, User, ShieldCheck, Leaf, Plane,
} from 'lucide-react';
import { useEffect } from 'react';

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

export default function TemplatesPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryId || null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  useEffect(() => {
    if (businesses && businesses.length === 0) {
      createBusiness('My Business').then(() => queryClient.invalidateQueries({ queryKey: ['businesses'] }));
    }
  }, [businesses, queryClient]);

  const createMutation = useMutation({
    mutationFn: (tpl: Template) => {
      const cat = CATEGORIES.find((c) => c.id === selectedCategory);
      return createRegister({
        businessId: businessId!, name: tpl.name, icon: tpl.icon,
        iconColor: cat?.color, category: cat?.name || 'general', template: tpl.name,
        columns: tpl.columns.map((c) => ({ name: c.name, type: c.type, dropdownOptions: c.dropdownOptions, formula: c.formula })),
      });
    },
    onSuccess: (newReg) => {
      queryClient.invalidateQueries({ queryKey: ['registers'] });
      navigate(`/register/${newReg.id}`);
    },
    onError: () => setCreatingTemplate(null),
  });

  const categoryData = selectedCategory ? CATEGORIES.find((c) => c.id === selectedCategory) : null;
  const subTemplates = selectedCategory ? TEMPLATES[selectedCategory] || [] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div className="register-header">
        <button className="register-header-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="register-header-title">Choose a Template</h1>
      </div>

      {/* Category Grid */}
      <div style={{ padding: '32px 40px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Select a Category</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
          Pick a business type to see ready-made templates
        </p>
        <div className="categories-grid" style={{ padding: 0 }}>
          {CATEGORIES.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || FileText;
            const count = (TEMPLATES[cat.id] || []).length;
            return (
              <div key={cat.id} className="category-card" onClick={() => setSelectedCategory(cat.id)}>
                <div className="category-icon" style={{ background: cat.color }}><Icon size={24} /></div>
                <div className="category-name">{cat.name}</div>
                <div className="category-count">{count} templates</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Template selection modal */}
      {selectedCategory && (
        <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '85vh' }}>
            <div className="template-modal-header" style={{ background: categoryData?.color || 'var(--navy)' }}>
              <div className="template-modal-header-icon">
                {(() => { const Icon = ICON_MAP[categoryData?.icon || ''] || FileText; return <Icon size={24} />; })()}
              </div>
              <div>
                <div className="template-modal-header-title">{categoryData?.name} Templates</div>
                <div className="template-modal-header-sub">Choose a layout to get started</div>
              </div>
              <button className="template-modal-close" onClick={() => setSelectedCategory(null)}><X size={20} /></button>
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
                <button
                  className="tpl-use-btn"
                  onClick={() => { setCreatingTemplate(tpl.name); createMutation.mutate(tpl); }}
                  disabled={!!creatingTemplate}
                >
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
