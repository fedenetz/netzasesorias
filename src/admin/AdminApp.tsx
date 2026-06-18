import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Activity, AlertTriangle, ArrowRight, Bell, Building2, CalendarDays, Check, ChevronDown,
  ChevronsUpDown, CircleDollarSign, Clock3, Cloud, FileSpreadsheet, Files, FolderOpen,
  LayoutDashboard, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, SlidersHorizontal,
  Users, X,
} from 'lucide-react';
import { clients as seedClients, docs } from './data';
import { F29_STATUS_LABELS, type ClientRow, type F29StatusCode } from './types';
import { persistF29Change } from './f29-api';
import { loadAdminRows, loadClientHistory, type PeriodHistory } from './f29-data';
import { supabase } from './supabase';

type Screen = 'dashboard' | 'clients' | 'f29' | 'f22' | 'client';

const nav = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'f29', label: 'F29 mensual', icon: CalendarDays },
  { id: 'f22', label: 'Renta / F22', icon: FileSpreadsheet },
] as const;

const statusClass: Record<string, string> = {
  Pendiente: 'is-pending', 'En proceso': 'is-progress', Listo: 'is-ready', Declarado: 'is-declared',
  Bloqueado: 'is-blocked', Pagado: 'is-paid', 'Sin pago': 'is-neutral',
  Cargada: 'is-ready', 'Error Dig.': 'is-blocked', Informada: 'is-declared', 'Pagada / Enviada': 'is-paid',
  'S/ Movi.': 'is-neutral', Postergado: 'is-pending', 'Rev. por Scarlen': 'is-progress',
};

function Checkbox({ value, label, onChange }: { value: boolean; label: string; onChange?: () => void }) {
  return <button className={`tiny-check ${value ? 'is-checked' : ''}`} type="button" aria-label={label} onClick={onChange}>{value && <Check size={13} />}</button>;
}

function Pill({ children, value }: { children: React.ReactNode; value?: string }) {
  return <span className={`status-pill ${statusClass[value ?? String(children)] ?? 'is-neutral'}`}><i />{children}</span>;
}

function EmptyAvatar({ initials }: { initials: string }) { return <span className="avatar">{initials}</span>; }

export function AdminApp({ user, preview }: { user: User | null; preview: boolean }) {
  const initialPath = window.location.pathname;
  const periodMatch = initialPath.match(/\/f29\/(\d{4})\/(\d{1,2})/);
  const activeYear = periodMatch ? Number(periodMatch[1]) : 2026;
  const activeMonth = periodMatch ? Number(periodMatch[2]) : 5;
  const [screen, setScreen] = useState<Screen>(initialPath.includes('/f29') ? 'f29' : initialPath.includes('/f22') ? 'f22' : initialPath.includes('/clients/') ? 'client' : initialPath.endsWith('/clients') ? 'clients' : 'dashboard');
  const [rows, setRows] = useState<ClientRow[]>(preview ? seedClients : []);
  const [selected, setSelected] = useState<ClientRow | null>(preview ? seedClients[0] : null);
  const [dataLoading, setDataLoading] = useState(!preview);
  const [dataError, setDataError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (preview) return;
    loadAdminRows(activeYear, activeMonth).then(liveRows => {
      setRows(liveRows);
      const routeRut = decodeURIComponent(window.location.pathname.replace('/clients/', ''));
      setSelected(liveRows.find(row => row.rut === routeRut) ?? liveRows[0] ?? null);
      setDataLoading(false);
    }).catch(error => {
      setDataError(error instanceof Error ? error.message : 'No fue posible cargar los datos de Supabase.');
      setDataLoading(false);
    });
  }, [activeMonth, activeYear, preview]);

  const go = (next: Screen, client?: ClientRow) => {
    if (client) setSelected(client);
    setScreen(next);
    const paths: Record<Screen, string> = { dashboard: '/control', clients: '/clients', f29: `/f29/${activeYear}/${String(activeMonth).padStart(2, '0')}`, f22: '/f22/2026', client: `/clients/${client?.rut ?? selected?.rut ?? ''}` };
    window.history.pushState({}, '', paths[next]);
    setSidebarOpen(false);
  };

  const updateRow = (id: string, patch: Partial<ClientRow>) => setRows(current => current.map(row => {
    if (row.id !== id) return row;
    void persistF29Change(row, patch).catch(error => console.error('No se pudo guardar el cambio F29', error));
    return { ...row, ...patch, updated: 'Ahora' };
  }));
  const displayName = user?.user_metadata?.full_name ?? 'Camila Soto';

  return (
    <div className="control-shell">
      <aside className={`control-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><span><img src="/brand/icono-blanco.png" alt="" /><strong>NETZ</strong></span><button onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <div className="workspace-switch"><span className="workspace-icon">N</span><span><strong>Netz Asesorías</strong><small>Operaciones</small></span><ChevronsUpDown size={15} /></div>
        <nav className="control-nav" aria-label="Operaciones">
          <p>Principal</p>
          {nav.map(item => <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => go(item.id)}><item.icon size={18} />{item.label}{item.id === 'f29' && <em>{rows.filter(row => row.periodId).length}</em>}</button>)}
          <p>Gestión</p>
          <button><Files size={18} />Documentos</button>
          <button><Activity size={18} />Actividad</button>
        </nav>
        <div className="sidebar-bottom">
          <button><Settings size={18} />Configuración</button>
          <div className="secure-note"><ShieldCheck size={17} /><span><strong>Entorno seguro</strong><small>Acceso solo empleados</small></span></div>
        </div>
      </aside>
      <main className="control-main">
        <header className="control-topbar">
          <button className="mobile-sidebar" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-search"><Search size={17} /><input placeholder="Buscar cliente, RUT o documento…" /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions">
            {preview && <span className="preview-badge">Vista local</span>}
            <button className="icon-button"><Bell size={18} /><i /></button>
            <div className="user-menu"><EmptyAvatar initials="CS" /><span><strong>{displayName}</strong><small>Contador senior</small></span><ChevronDown size={15} /></div>
          </div>
        </header>
        {dataLoading && <div className="control-data-state">Cargando datos de Supabase…</div>}
        {dataError && <div className="control-data-state is-error"><AlertTriangle size={18} />{dataError}</div>}
        {!dataLoading && !dataError && screen === 'dashboard' && <Dashboard rows={rows} go={go} />}
        {!dataLoading && !dataError && screen === 'f29' && <F29Dashboard rows={rows.filter(row => row.periodId)} updateRow={updateRow} go={go} />}
        {!dataLoading && !dataError && screen === 'f22' && <F22Dashboard />}
        {!dataLoading && !dataError && screen === 'clients' && <ClientsIndex rows={rows} go={go} />}
        {!dataLoading && !dataError && screen === 'client' && selected && <ClientProfile client={selected} />}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="control-page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{actions}</div></div>;
}

function Dashboard({ rows, go }: { rows: ClientRow[]; go: (s: Screen, c?: ClientRow) => void }) {
  const periods = rows.filter(row => row.periodId);
  const completed = periods.filter(row => row.statusCode === 'D').length;
  const informed = periods.filter(row => row.statusCode === 'C').length;
  const loaded = periods.filter(row => row.statusCode === 'A').length;
  const pending = periods.filter(row => row.statusCode === 'E' || row.statusCode === null).length;
  const blocked = periods.filter(row => row.statusCode === 'B' || row.statusCode === 'H').length;
  const completion = periods.length ? Math.round((completed / periods.length) * 100) : 0;
  return <div className="control-content">
    <PageHeader eyebrow="Jueves, 18 de junio" title="Buenos días, Camila" description="Este es el estado tributario de tu cartera al día de hoy." actions={<><button className="button-ghost"><Cloud size={16} /> Escanear Drive</button><button className="button-dark" onClick={() => go('f29')}>Ir a F29 <ArrowRight size={16} /></button></>} />
    <div className="metrics-grid">
      <Metric icon={<Building2 />} label="Clientes activos" value={String(rows.length)} note={`${periods.length} con período F29 actual`} tone="blue" />
      <Metric icon={<Check />} label="Pagados / enviados" value={String(completed)} note={`${completion}% del período`} tone="green" progress={completion} />
      <Metric icon={<Clock3 />} label="Trabajo pendiente" value={String(pending)} note="Incluye períodos sin estado" tone="gold" />
      <Metric icon={<AlertTriangle />} label="Requieren revisión" value={String(blocked)} note="Error Dig. o Rev. por Scarlen" tone="red" />
    </div>
    <div className="dashboard-grid">
      <section className="control-card span-two"><CardHead title="F29 · Mayo 2026" subtitle="Vencimiento general: 20 jun" action={<button onClick={() => go('f29')}>Ver dashboard <ArrowRight size={14} /></button>} />
        <div className="progress-overview"><div className="progress-ring" style={{ background: `radial-gradient(closest-side,#fff 75%,transparent 76%),conic-gradient(var(--green) ${completion}%,#edf0ed 0)` }}><strong>{completion}%</strong><span>completado</span></div><div className="progress-legend"><p><i className="legend-ready" />Pagada / Enviada <strong>{completed}</strong></p><p><i className="legend-progress" />Cargada / Informada <strong>{loaded + informed}</strong></p><p><i className="legend-pending" />Pendiente / Sin estado <strong>{pending}</strong></p><p><i className="legend-blocked" />Revisión requerida <strong>{blocked}</strong></p></div></div>
      </section>
      <section className="control-card"><CardHead title="Renta · AT 2026" subtitle="Módulo en preparación" /><div className="annual-score"><span>—</span><strong>Sin datos F22 importados</strong><div><i style={{ width: '0%' }} /></div><small>La estructura anual está disponible para la siguiente fase</small></div></section>
      <section className="control-card span-two"><CardHead title="Atención requerida" subtitle="Clientes con bloqueos o atrasos" action={<button>Ver todos</button>} />
        <div className="attention-list">{rows.filter(r => ['B', 'E', 'H'].includes(r.statusCode ?? '')).slice(0, 3).map(r => <button key={r.id} onClick={() => go('client', r)}><EmptyAvatar initials={r.initials} /><span><strong>{r.name}</strong><small>{r.observation || 'Declaración aún no iniciada'}</small></span><Pill value={r.statusLabel}>{r.statusLabel}</Pill><ArrowRight size={16} /></button>)}</div>
      </section>
      <section className="control-card"><CardHead title="Datos sincronizados" subtitle="Supabase · período actual" /><ul className="activity-feed"><li><span className="activity-system"><Cloud size={15} /></span><span><strong>{rows.length} clientes cargados</strong><small>{periods.length} períodos F29 disponibles</small></span></li><li><span className="activity-system"><ShieldCheck size={15} /></span><span><strong>Credenciales excluidas</strong><small>Solo metadatos operacionales</small></span></li></ul></section>
    </div>
  </div>;
}

function Metric({ icon, label, value, note, tone, progress }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string; progress?: number }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p>{progress && <div className="metric-progress"><i style={{ width: `${progress}%` }} /></div>}</div></article>;
}

function CardHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <header className="card-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>; }

function F29Dashboard({ rows, updateRow, go }: { rows: ClientRow[]; updateRow: (id: string, patch: Partial<ClientRow>) => void; go: (s: Screen, c?: ClientRow) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [responsible, setResponsible] = useState('Todos');
  const [onlyObserved, setOnlyObserved] = useState(false);
  const responsibles = [...new Set(rows.map(row => row.accountant))];
  const filtered = useMemo(() => rows.filter(row =>
    (filter === 'Todos' || row.statusCode === filter) &&
    (responsible === 'Todos' || row.accountant === responsible) &&
    (!onlyObserved || Boolean(row.observation.trim())) &&
    `${row.rut} ${row.name}`.toLowerCase().includes(query.toLowerCase())
  ), [rows, query, filter, responsible, onlyObserved]);
  const counts = Object.fromEntries((Object.keys(F29_STATUS_LABELS) as F29StatusCode[]).map(code => [code, rows.filter(row => row.statusCode === code).length]));
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  const updateStatus = (row: ClientRow, code: F29StatusCode) => updateRow(row.id, { statusCode: code, statusLabel: F29_STATUS_LABELS[code] });
  return <div className="control-content wide-content">
    <PageHeader eyebrow="Operación mensual" title="F29 · Mayo 2026" description="Control de declaraciones mensuales de toda la cartera." actions={<><button className="period-button"><CalendarDays size={16} /> Mayo 2026 <ChevronDown size={15} /></button><button className="button-dark"><Cloud size={16} /> Escanear Drive</button></>} />
    <div className="f29-kpis">
      <MiniMetric label="Total clientes" value={rows.length} /><MiniMetric label="Cargada" value={counts.A} tone="green" /><MiniMetric label="Error Dig." value={counts.B} tone="red" /><MiniMetric label="Informada" value={counts.C} tone="blue" /><MiniMetric label="Pagada / Enviada" value={counts.D} tone="green" /><MiniMetric label="Pendiente" value={counts.E} tone="gold" /><MiniMetric label="S/ Movi." value={counts.F} /><MiniMetric label="Postergado" value={counts.G} tone="gold" /><MiniMetric label="Rev. por Scarlen" value={counts.H} tone="red" /><MiniMetric label="Monto total" value={money.format(totalAmount)} tone="blue" /><MiniMetric label="Sin fecha" value={rows.filter(row => !row.filedDate).length} tone="gold" /><MiniMetric label="Con observaciones" value={rows.filter(row => row.observation).length} />
    </div>
    <section className="operations-card">
      <div className="table-toolbar f29-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por RUT o razón social…" /></div><select aria-label="Filtrar por estado" value={filter} onChange={event => setFilter(event.target.value)}><option value="Todos">Todos los estados</option>{Object.entries(F29_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select><select aria-label="Filtrar por responsable" value={responsible} onChange={event => setResponsible(event.target.value)}><option>Todos</option>{responsibles.map(name => <option key={name}>{name}</option>)}</select><button className={`filter-button ${onlyObserved ? 'active' : ''}`} onClick={() => setOnlyObserved(value => !value)}><SlidersHorizontal size={15} /> Con observación</button></div>
      <div className="table-scroll"><table className="ops-table f29-ops-table"><thead><tr><th>RUT</th><th className="sticky-client">Razón social</th><th>Responsable</th><th>Monto</th><th>Fecha</th><th>Estado</th><th>Vence</th><th>Observación</th><th>Docs</th><th>Última actualización</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><strong>{row.rut}</strong></td><td className="sticky-client"><button className="client-cell" onClick={() => go('client', row)}><strong>{row.name}</strong></button></td><td><select className="inline-select" aria-label={`Responsable de ${row.name}`} value={row.accountant} onChange={event => updateRow(row.id, { accountant: event.target.value })}>{responsibles.map(name => <option key={name}>{name}</option>)}</select></td><td><input className="inline-number" aria-label={`Monto de ${row.name}`} type="number" value={row.amount ?? ''} onChange={event => updateRow(row.id, { amount: event.target.value ? Number(event.target.value) : null })} /></td><td><input className="inline-date" aria-label={`Fecha de ${row.name}`} type="date" value={row.filedDate ?? ''} onChange={event => updateRow(row.id, { filedDate: event.target.value || null })} /></td><td><select className={`inline-status ${statusClass[row.statusLabel]}`} aria-label={`Estado de ${row.name}`} value={row.statusCode ?? ''} onChange={event => updateStatus(row, event.target.value as F29StatusCode)}><option value="" disabled>— Sin estado</option>{Object.entries(F29_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></td><td><span className="due-day">Día {row.dueDay ?? '—'}</span></td><td><input className="inline-note" value={row.observation} placeholder="Agregar observación…" onChange={event => updateRow(row.id, { observation: event.target.value })} /></td><td><button className="document-count"><Files size={14} />{row.documents}</button></td><td>{row.updated}</td></tr>)}</tbody></table></div>
      <footer className="table-footer"><span>Mostrando {filtered.length} de {rows.length} clientes</span><span>Los cambios se guardan automáticamente</span></footer>
    </section>
  </div>;
}

function MiniMetric({ label, value, tone = '' }: { label: string; value: number | string; tone?: string }) { return <div className={`mini-metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }

function ClientsIndex({ rows, go }: { rows: ClientRow[]; go: (s: Screen, c?: ClientRow) => void }) {
  const [query, setQuery] = useState('');
  const filtered = rows.filter(r => `${r.rut} ${r.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="control-content"><PageHeader eyebrow="Base maestra" title="Clientes" description="Una vista única de la cartera activa y su cumplimiento." actions={<button className="button-dark">+ Nuevo cliente</button>} /><section className="operations-card"><div className="table-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar RUT o razón social…" /></div><button className="filter-button"><SlidersHorizontal size={15} /> Contador</button><button className="filter-button">Activos <ChevronDown size={14} /></button></div><div className="table-scroll"><table className="ops-table clients-table"><thead><tr><th>RUT</th><th>Razón social</th><th>Contador asignado</th><th>Drive</th><th>F29 actual</th><th>F22 actual</th><th>Última actualización</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} onClick={() => go('client', row)}><td><strong>{row.rut}</strong></td><td><strong>{row.name}</strong></td><td><span className="assigned"><EmptyAvatar initials={row.initials} />{row.accountant}</span></td><td><button className="drive-button"><FolderOpen size={15} /> Abrir carpeta</button></td><td><Pill value={row.statusLabel}>{row.statusLabel}</Pill></td><td><Pill value="Declarado">Enviado</Pill></td><td>{row.updated}</td></tr>)}</tbody></table></div></section></div>;
}

function F22Dashboard() {
  return <div className="control-content wide-content"><PageHeader eyebrow="Operación anual" title="Renta · Año Tributario 2026" description="Seguimiento de BCE, declaraciones juradas y F22." actions={<button className="period-button">AT 2026 <ChevronDown size={15} /></button>} /><div className="compact-metrics"><MiniMetric label="Clientes" value={48} /><MiniMetric label="BCE listos" value={44} tone="green" /><MiniMetric label="F22 enviados" value={42} tone="blue" /><MiniMetric label="Pendientes" value={6} tone="gold" /></div><section className="operations-card"><div className="table-toolbar"><div className="toolbar-search"><Search size={16} /><input placeholder="Buscar por RUT o cliente…" /></div><button className="filter-button"><SlidersHorizontal size={15} /> Filtros</button></div><div className="table-scroll"><table className="ops-table f22-table"><thead><tr><th>Cliente</th><th>Fecha BCE</th><th>BCE</th><th>RN / F22</th><th>F22 enviado</th><th>DJ 1948</th><th>DJ 1949</th><th>Provisorio</th><th>Utilidad / Pérdida</th><th>Dividendos</th><th>Asignado</th></tr></thead><tbody>{seedClients.slice(0, 6).map((row, i) => <tr key={row.id}><td><strong>{row.name}</strong><small className="block-rut">{row.rut}</small></td><td>{i < 4 ? `${12 + i} abr 2026` : '—'}</td><td><Pill value={i < 4 ? 'Listo' : 'Pendiente'}>{i < 4 ? 'Listo' : 'Pendiente'}</Pill></td><td><Checkbox value={i < 4} label="RN F22" /></td><td><Checkbox value={i < 3} label="F22 enviado" /></td><td><Checkbox value={i !== 4} label="DJ 1948" /></td><td><Checkbox value={i < 4} label="DJ 1949" /></td><td>{i === 2 ? 'Sí' : 'No'}</td><td className={i === 4 ? 'negative' : 'positive'}>{i === 4 ? '−$4.210.500' : `$${(12 + i * 7)}.840.000`}</td><td>{i % 2 ? '$0' : '$2.450.000'}</td><td><span className="assigned"><EmptyAvatar initials={row.initials} />{row.accountant.split(' ')[0]}</span></td></tr>)}</tbody></table></div></section></div>;
}

function ClientProfile({ client }: { client: ClientRow }) {
  const [tab, setTab] = useState('Resumen');
  const [history, setHistory] = useState<PeriodHistory[]>([]);
  useEffect(() => { void loadClientHistory(client.id).then(setHistory).catch(() => setHistory([])); }, [client.id]);
  return <div className="control-content"><div className="client-profile-head"><div className="client-monogram">{client.name.charAt(0)}</div><div><span>Cliente activo</span><h1>{client.name}</h1><p>{client.rut} · {client.accountant}</p></div><div className="page-actions"><button className="button-ghost"><FolderOpen size={16} /> Abrir Drive</button><button className="button-dark">Editar cliente</button></div></div><nav className="profile-tabs">{['Resumen', 'F29 mensual', 'Renta / F22', 'Documentos', 'Observaciones', 'Actividad'].map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}{item === 'Documentos' && <em>{docs.length}</em>}</button>)}</nav>{tab === 'Documentos' ? <Documents /> : tab === 'Actividad' ? <ActivityPanel client={client} /> : <ClientSummary client={client} history={history} />}</div>;
}

function ClientSummary({ client, history }: { client: ClientRow; history: PeriodHistory[] }) { const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return <div className="profile-grid"><section className="control-card"><CardHead title="F29 · Mayo 2026" subtitle="Período actual" /><div className="profile-status"><Pill value={client.statusLabel}>{client.statusLabel}</Pill><strong>{client.amount === null ? '—' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(client.amount)}</strong><span>{client.filedDate ? `Presentado ${client.filedDate}` : 'Fecha pendiente'}</span></div></section><section className="control-card"><CardHead title="Renta · AT 2026" subtitle="Estructura preparada" /><div className="profile-status"><Pill value="Pendiente">Próxima temporada</Pill><strong>—</strong><span>sin datos anuales todavía</span></div></section><section className="control-card span-two"><CardHead title="Historial F29" subtitle="Últimos seis períodos" /><div className="history-row">{history.slice(0, 6).map(period => <div key={period.id}><span>{monthNames[period.month - 1]} {String(period.year).slice(-2)}</span><i className={period.status_code === 'B' || period.status_code === 'H' ? 'blocked' : 'done'}>{period.status_code ?? '—'}</i><small>{period.status_label ?? 'Sin estado'}</small></div>)}</div>{!history.length && <p className="empty-history">Sin períodos F29 registrados.</p>}</section><section className="control-card span-two"><CardHead title="Observaciones" subtitle="Notas operativas del equipo" action={<button>+ Agregar</button>} /><div className="observation-box"><EmptyAvatar initials={client.initials} /><div><strong>{client.accountant}</strong><p>{client.observation || 'Cliente al día. Sin observaciones pendientes para este período.'}</p><small>Actualizado {client.updated.toLowerCase()}</small></div></div></section></div>; }

function Documents() { const [scanning, setScanning] = useState(false); return <section className="operations-card documents-panel"><div className="documents-head"><div><h2>Documentos en Google Drive</h2><p>Archivos sincronizados desde la carpeta del cliente.</p></div><button className="button-dark" onClick={() => { setScanning(true); setTimeout(() => setScanning(false), 1000); }}><Cloud size={16} />{scanning ? 'Escaneando…' : 'Escanear carpeta'}</button></div><table className="ops-table"><thead><tr><th>Archivo</th><th>Tipo</th><th>Modificado</th><th>Período</th><th>Estado</th><th /></tr></thead><tbody>{docs.map(doc => <tr key={doc.name}><td><span className="file-name"><FileSpreadsheet size={18} /><span><strong>{doc.name}</strong><small>{doc.mime}</small></span></span></td><td><Pill value="Listo">{doc.type}</Pill></td><td>{doc.modified}</td><td>{doc.period}</td><td><Pill value={doc.status === 'Procesado' ? 'Declarado' : 'Pendiente'}>{doc.status}</Pill></td><td><button className="drive-button">Abrir en Drive <ArrowRight size={13} /></button></td></tr>)}</tbody></table></section>; }

function ActivityPanel({ client }: { client: ClientRow }) { return <section className="control-card activity-panel"><CardHead title="Historial de actividad" subtitle={`Trazabilidad completa de ${client.name}`} /><ul className="timeline"><li><span><Check size={14} /></span><div><strong>Estado F29 actualizado a “{client.statusLabel}”</strong><p>{client.accountant} · Hoy, 09:42</p></div></li><li><span><Cloud size={14} /></span><div><strong>Carpeta de Drive escaneada</strong><p>4 archivos actualizados · Ayer, 16:08</p></div></li><li><span><FileSpreadsheet size={14} /></span><div><strong>RCV_2026-05.xlsx clasificado como RCV</strong><p>Sistema · 16 jun 2026, 09:41</p></div></li></ul></section>; }
