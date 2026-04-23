import { AlertCircle, X, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';

function OptionsEditor({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [opts, setOpts] = useState<string[]>([]);
  
  useEffect(() => {
    setOpts(value ? value.split(',').map(s => s.trim()).filter(Boolean) : []);
  }, [value]);

  const updateOpts = (newOpts: string[]) => {
    setOpts(newOpts);
    onChange(newOpts.join(','));
  };

  return (
    <div className="options-editor-container">
      {opts.map((opt, i) => (
        <div key={i} className="options-editor-row" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
          <input 
            className="modal-input" 
            style={{ marginBottom: 0 }} 
            value={opt} 
            onChange={(e) => {
              const newOpts = [...opts];
              newOpts[i] = e.target.value;
              updateOpts(newOpts);
            }} 
            placeholder="Option name" 
          />
          <button 
            type="button" 
            onClick={() => {
              const newOpts = [...opts];
              newOpts.splice(i, 1);
              updateOpts(newOpts);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button 
        type="button" 
        onClick={() => updateOpts([...opts, `Option ${opts.length + 1}`])}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px dashed var(--border)', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', color: 'var(--navy)', width: '100%', justifyContent: 'center', fontSize: '13px', fontWeight: 500 }}
      >
        <Plus size={14} /> Add Option
      </button>
    </div>
  );
}

interface ColumnModalsProps {
  // New Column / Insert Column
  newColumnModal: boolean;
  setNewColumnModal: (v: boolean) => void;
  insertColModal: 'left' | 'right' | null;
  setInsertColModal: (v: 'left' | 'right' | null) => void;
  newColName: string;
  setNewColName: (v: string) => void;
  newColType: string;
  setNewColType: (v: string) => void;
  newColDropdownOpts: string;
  setNewColDropdownOpts: (v: string) => void;
  newColFormula: string;
  setNewColFormula: (v: string) => void;
  addColumnMutation: any;
  insertColumnMutation: any;

  // Rename Column
  renameColModal: boolean;
  setRenameColModal: (v: boolean) => void;
  renameColValue: string;
  setRenameColValue: (v: string) => void;
  renameColumnMutation: any;

  // Dropdown Config
  dropdownConfigModal: boolean;
  setDropdownConfigModal: (v: boolean) => void;
  dropdownConfigOptions: string;
  setDropdownConfigOptions: (v: string) => void;
  updateDropdownMutation: any;

  // Change Type
  changeTypeModal: boolean;
  setChangeTypeModal: (v: boolean) => void;
  changeTypeValue: string;
  setChangeTypeValue: (v: string) => void;
  changeColumnTypeMutation: any;

  COL_TYPES: any[];
}

export function ColumnModals(props: ColumnModalsProps) {
  const {
    newColumnModal, setNewColumnModal, insertColModal, setInsertColModal,
    newColName, setNewColName, newColType, setNewColType,
    newColDropdownOpts, setNewColDropdownOpts, newColFormula, setNewColFormula,
    addColumnMutation, insertColumnMutation,
    renameColModal, setRenameColModal, renameColValue, setRenameColValue, renameColumnMutation,
    dropdownConfigModal, setDropdownConfigModal, dropdownConfigOptions, setDropdownConfigOptions, updateDropdownMutation,
    changeTypeModal, setChangeTypeModal, changeTypeValue, setChangeTypeValue, changeColumnTypeMutation,
    COL_TYPES
  } = props;

  return (
    <>
      {/* ── Add New Column ── */}
      {newColumnModal && (
        <div className="modal-overlay" onClick={() => setNewColumnModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add New Column</h3>
            <label className="modal-label">Column Name</label>
            <input className="modal-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newColName.trim() && addColumnMutation.mutate()} placeholder="e.g. Amount" autoFocus />
            <label className="modal-label">Column Type</label>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${newColType === t.id ? 'active' : ''}`} onClick={() => setNewColType(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {newColType === 'dropdown' && (
              <>
                <label className="modal-label" style={{ marginTop: '12px', display: 'block', marginBottom: '8px' }}>Options</label>
                <OptionsEditor value={newColDropdownOpts} onChange={setNewColDropdownOpts} />
              </>
            )}
            {newColType === 'formula' && (
              <>
                <label className="modal-label">Formula</label>
                <input className="modal-input" value={newColFormula} onChange={(e) => setNewColFormula(e.target.value)} placeholder="e.g. {Marks}/{Full Marks}*100" />
                <div className="formula-hint">
                  <AlertCircle size={14} color="var(--muted)" />
                  <span className="formula-hint-text">Use {'{Column Name}'} to reference other columns. Supports +, -, *, /</span>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setNewColumnModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!newColName.trim()} onClick={() => addColumnMutation.mutate()}>
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename Column ── */}
      {renameColModal && (
        <div className="modal-overlay" onClick={() => setRenameColModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Column</h3>
            <input className="modal-input" value={renameColValue} onChange={(e) => setRenameColValue(e.target.value)} placeholder="New column name" autoFocus />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setRenameColModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!renameColValue.trim()} onClick={() => renameColumnMutation.mutate()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dropdown Config ── */}
      {dropdownConfigModal && (
        <div className="modal-overlay" onClick={() => setDropdownConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Dropdown Options</h3>
            <label className="modal-label" style={{ marginBottom: '8px', display: 'block' }}>Options</label>
            <OptionsEditor value={dropdownConfigOptions} onChange={setDropdownConfigOptions} />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDropdownConfigModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={() => updateDropdownMutation.mutate()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Type ── */}
      {changeTypeModal && (
        <div className="modal-overlay" onClick={() => setChangeTypeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Change Column Type</h3>
            <p className="modal-p-text">Changing the type may affect existing data in this column.</p>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${changeTypeValue === t.id ? 'active' : ''}`} onClick={() => setChangeTypeValue(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setChangeTypeModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={() => changeColumnTypeMutation.mutate()}>Change Type</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Insert Column ── */}
      {insertColModal !== null && (
        <div className="modal-overlay" onClick={() => setInsertColModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Insert Column {insertColModal === 'left' ? 'Left' : 'Right'}</h3>
            <label className="modal-label">Column Name</label>
            <input className="modal-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="e.g. Amount" autoFocus />
            <label className="modal-label">Column Type</label>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${newColType === t.id ? 'active' : ''}`} onClick={() => setNewColType(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {newColType === 'dropdown' && (
              <>
                <label className="modal-label" style={{ marginTop: '12px', display: 'block', marginBottom: '8px' }}>Options</label>
                <OptionsEditor value={newColDropdownOpts} onChange={setNewColDropdownOpts} />
              </>
            )}
            {newColType === 'formula' && (
              <>
                <label className="modal-label">Formula</label>
                <input className="modal-input" value={newColFormula} onChange={(e) => setNewColFormula(e.target.value)} placeholder="e.g. {Marks}/{Full Marks}*100" />
                <div className="formula-hint">
                  <AlertCircle size={14} color="var(--muted)" />
                  <span className="formula-hint-text">Use {'{Column Name}'} to reference other columns. Supports +, -, *, /</span>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setInsertColModal(null)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!newColName.trim()} onClick={() => insertColumnMutation.mutate()}>Insert Column</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
