import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Plus, ShieldCheck, UserCheck, UserRound, X } from 'lucide-react';
import { loadEmployeeAccess, saveEmployeeAccess } from './admin-api';
import type { EmployeeAccess, EmployeeRole } from './types';

const roleLabel: Record<EmployeeRole, string> = { admin: 'Administrador', accountant: 'Contador', viewer: 'Solo lectura' };

export function AdminSettings({ preview }: { preview: boolean }) {
  const [employees, setEmployees] = useState<EmployeeAccess[]>([]);
  const [editing, setEditing] = useState<Partial<EmployeeAccess> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setEmployees(preview ? [
    { id: 'preview-admin', profileId: 'preview-admin', email: 'richard@ainahue.cl', fullName: 'RICHARD', role: 'admin', isActive: true, hasSignedIn: true },
    { id: 'preview-gabriela', profileId: null, email: 'gabriela@netzasesorias.cl', fullName: 'GABRIELA', role: 'accountant', isActive: true, hasSignedIn: false },
  ] : await loadEmployeeAccess()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cargar los empleados.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [preview]);
  const save = async () => {
    if (!editing?.email?.trim() || !editing.fullName?.trim()) return;
    setSaving(true); setError('');
    try {
      if (preview) {
        setEmployees(current => [...current.filter(item => item.id !== editing.id), { id: editing.id ?? crypto.randomUUID(), profileId: editing.profileId ?? null, email: editing.email!, fullName: editing.fullName!, role: editing.role ?? 'accountant', isActive: editing.isActive ?? true, hasSignedIn: editing.hasSignedIn ?? false }]);
        setEditing(null);
      } else {
        await saveEmployeeAccess({ id: editing.id, email: editing.email, fullName: editing.fullName, role: editing.role ?? 'accountant', isActive: editing.isActive ?? true });
        setEditing(null); await load();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar el acceso.'); } finally { setSaving(false); }
  };
  return <div className="control-content wide-content"><div className="control-page-head"><div><span>Administración</span><h1>Equipo y acceso</h1><p>Correos autorizados, roles y vínculo usado para responsables y CC obligatorios.</p></div><div className="page-actions"><button className="button-dark" onClick={() => setEditing({ role: 'accountant', isActive: true })}><Plus size={15}/> Autorizar correo</button></div></div>
    <div className="settings-security-note"><ShieldCheck size={18}/><div><strong>Safelist activa</strong><p>Un correo autorizado queda listo para ingresar con Google. Si ya inició sesión, sus datos de Perfil se actualizan inmediatamente.</p></div></div>
    {error && <div className="control-data-state is-error"><AlertTriangle size={16}/>{error}</div>}
    <section className="operations-card"><div className="documents-head"><div><h2>Empleados</h2><p>El nombre debe coincidir con el responsable mostrado en F29.</p></div><span className="employee-count"><UserRound size={15}/>{employees.filter(item => item.isActive).length} activos</span></div>
      {loading ? <div className="control-data-state">Cargando equipo…</div> : <div className="table-scroll"><table className="ops-table employee-table"><thead><tr><th>Nombre operativo</th><th>Email</th><th>Rol</th><th>Cuenta Google</th><th>Acceso</th><th/></tr></thead><tbody>{employees.map(employee => <tr key={employee.id}><td><strong>{employee.fullName}</strong></td><td>{employee.email}</td><td>{roleLabel[employee.role]}</td><td><span className={`status-pill ${employee.hasSignedIn ? 'is-paid' : 'is-pending'}`}><i/>{employee.hasSignedIn ? 'Vinculada' : 'Primer ingreso pendiente'}</span></td><td>{employee.isActive ? <span className="access-active"><Check size={13}/>Activo</span> : 'Inactivo'}</td><td><button className="drive-button" onClick={() => setEditing(employee)}>Editar</button></td></tr>)}</tbody></table></div>}
    </section>
    {editing && <div className="modal-backdrop"><section className="control-modal"><header><div><span>Safelist de empleados</span><h2>{editing.id ? 'Editar acceso' : 'Autorizar correo'}</h2></div><button onClick={() => setEditing(null)}><X size={18}/></button></header><label>Nombre operativo<input value={editing.fullName ?? ''} onChange={event => setEditing({ ...editing, fullName: event.target.value })} placeholder="Ej. GABRIELA"/></label><small>Usa exactamente el nombre asignado en F29 para vincular correctamente al responsable.</small><label>Email Google<input type="email" value={editing.email ?? ''} onChange={event => setEditing({ ...editing, email: event.target.value.toLowerCase() })} placeholder="nombre@dominio.cl"/></label><label>Rol<select value={editing.role ?? 'accountant'} onChange={event => setEditing({ ...editing, role: event.target.value as EmployeeRole })}>{Object.entries(roleLabel).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="modal-check"><input type="checkbox" checked={editing.isActive ?? true} onChange={event => setEditing({ ...editing, isActive: event.target.checked })}/><UserCheck size={15}/> Acceso activo</label><footer><button className="button-ghost" onClick={() => setEditing(null)}>Cancelar</button><button className="button-dark" disabled={saving || !editing.email?.trim() || !editing.fullName?.trim()} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar acceso'}</button></footer></section></div>}
  </div>;
}
