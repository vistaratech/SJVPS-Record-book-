import { Menu, Search, Plus, FileText, MoreVertical, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RegisterSummary, Business } from '../../lib/api';

interface SidebarProps {
  businesses?: Business[];
  filtered?: RegisterSummary[];
  search: string;
  setSearch: (v: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  menuId: number | null;
  setMenuId: (id: number | null) => void;
}

export function Sidebar({
  businesses,
  filtered,
  search,
  setSearch,
  sidebarOpen,
  setSidebarOpen,
  menuId,
  setMenuId,
}: SidebarProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Mobile top bar (hamburger) */}
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div className="mobile-topbar-brand">
          <img src="/logo-transparent.png" alt="AG Trust" className="mobile-topbar-logo" />
          <span>AG Trust</span>
        </div>
        <button className="mobile-topbar-add" onClick={() => navigate('/templates')} aria-label="Add register"><Plus size={20} /></button>
      </div>

      {/* ── Sidebar ── */}
      <div className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        {/* Brand Strip — deep green, school logo */}
        <div className="sidebar-brand">
          <img src="/logo-transparent.png" alt="AG Trust" className="sidebar-brand-logo" />
          <div>
            <div className="sidebar-brand-name">AG Trust</div>
            <div className="sidebar-brand-sub">Trusted Partners</div>
          </div>
          {/* Mobile close button */}
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
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
              onClick={() => { navigate(`/register/${reg.id}`); setSidebarOpen(false); }}
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
              >
                <MoreVertical size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <img src="/logo-transparent.png" alt="AG Trust" className="sidebar-footer-logo" />
          <span className="sidebar-footer-text">AG Trust · Record Book</span>
        </div>
      </div>
    </>
  );
}
