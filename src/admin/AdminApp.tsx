import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Activity, AlertTriangle, ArrowRight, Bell, Building2, CalendarDays, Check, ChevronDown,
  ChevronsUpDown, CircleDollarSign, Clock3, Cloud, FileSpreadsheet, Files, FolderOpen,
  LayoutDashboard, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, SlidersHorizontal,
  Users, X, Plus, Save, ExternalLink, RefreshCw,
} from 'lucide-react';
import { clients as seedClients, docs } from './data';
import { F29_STATUS_LABELS, type ActivityEntry, type ClientDocument, type ClientObservation, type ClientRow, type DocumentKind, type F29StatusCode } from './types';
import { persistF29Change } from './f29-api';
import { loadAdminRows, loadClientHistory, type PeriodHistory } from './f29-data';
import { addClientObservation, classifyDocument, DriveAuthorizationError, loadClientActivity, loadClientDocuments, loadClientObservations, saveClient, scanClientDrive } from './client-api';
import { connectGoogleDrive, supabase } from './supabase';

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
  const initialYear = periodMatch ? Number(periodMatch[1]) : 2026;
  const initialMonth = periodMatch ? Number(periodMatch[2]) : 5;
  const [activeYear, setActiveYear] = useState(initialYear);
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [screen, setScreen] = useState<Screen>(initialPath.includes('/f29') ? 'f29' : initialPath.includes('/f22') ? 'f22' : initialPath.includes('/clients/') ? 'client' : initialPath.endsWith('/clients') ? 'clients' : 'dashboard');
  const [rows, setRows] = useState<ClientRow[]>(preview ? seedClients : []);
  const [selected, setSelected] = useState<ClientRow | null>(preview ? seedClients[0] : null);
  const [dataLoading, setDataLoading] = useState(!preview);
  const [dataError, setDataError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

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

  const navigatePeriod = (year: number, month: number) => {
    setActiveYear(year); setActiveMonth(month); setScreen('f29');
    window.history.pushState({}, '', `/f29/${year}/${String(month).padStart(2, '0')}`);
  };

  const reloadRows = async () => {
    if (preview) return;
    const liveRows = await loadAdminRows(activeYear, activeMonth);
    setRows(liveRows);
    setSelected(current => current ? liveRows.find(row => row.id === current.id) ?? current : liveRows[0] ?? null);
  };

  const updateRow = async (id: string, patch: Partial<ClientRow>) => {
    const row = rows.find(item => item.id === id);
    if (!row) return;
    if (preview) {
      setRows(current => current.map(item => item.id === id ? { ...item, ...patch, updated: 'Ahora' } : item));
      setSaveStates(current => ({ ...current, [id]: 'saved' }));
      return;
    }
    setSaveStates(current => ({ ...current, [id]: 'saving' }));
    setRows(current => current.map(item => item.id === id ? { ...item, ...patch, updated: 'Ahora' } : item));
    try {
      const periodId = await persistF29Change(row, patch);
      setRows(current => current.map(item => item.id === id ? { ...item, ...patch, periodId, updated: 'Ahora' } : item));
      setSaveStates(current => ({ ...current, [id]: 'saved' }));
    } catch (error) {
      console.error('No se pudo guardar el cambio F29', error);
      setRows(current => current.map(item => item.id === id ? row : item));
      setSaveStates(current => ({ ...current, [id]: 'error' }));
    }
  };
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
        {!dataLoading && !dataError && screen === 'dashboard' && <Dashboard rows={rows} go={go} year={activeYear} month={activeMonth} />}
        {!dataLoading && !dataError && screen === 'f29' && <F29DashboardV2 rows={rows} updateRow={updateRow} go={go} year={activeYear} month={activeMonth} navigatePeriod={navigatePeriod} saveStates={saveStates} />}
        {!dataLoading && !dataError && screen === 'f22' && <F22Dashboard />}
        {!dataLoading && !dataError && screen === 'clients' && <ClientsIndexV2 rows={rows} go={go} reload={reloadRows} />}
        {!dataLoading && !dataError && screen === 'client' && selected && <ClientProfileV2 client={selected} year={activeYear} month={activeMonth} reload={reloadRows} />}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="control-page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{actions}</div></div>;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '—';
const dateTime = (value: string) => new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function Dashboard({ rows, go, year, month }: { rows: ClientRow[]; go: (s: Screen, c?: ClientRow) => void; year: number; month: number }) {
  const periods = rows.filter(row => row.periodId);
  const completed = periods.filter(row => row.statusCode === 'D').length;
  const informed = periods.filter(row => row.statusCode === 'C').length;
  const loaded = periods.filter(row => row.statusCode === 'A').length;
  const pending = periods.filter(row => row.statusCode === 'E' || row.statusCode === null).length;
  const blocked = periods.filter(row => row.statusCode === 'B' || row.statusCode === 'H').length;
  const completion = periods.length ? Math.round((completed / periods.length) * 100) : 0;
  return <div className="control-content">
    <PageHeader eyebrow={new Intl.DateTimeFormat('es-CL', { dateStyle: 'full' }).format(new Date())} title="Control tributario" description="Este es el estado tributario de la cartera al día de hoy." actions={<button className="button-dark" onClick={() => go('f29')}>Ir a F29 <ArrowRight size={16} /></button>} />
    <div className="metrics-grid">
      <Metric icon={<Building2 />} label="Clientes activos" value={String(rows.length)} note={`${periods.length} con período F29 actual`} tone="blue" />
      <Metric icon={<Check />} label="Pagados / enviados" value={String(completed)} note={`${completion}% del período`} tone="green" progress={completion} />
      <Metric icon={<Clock3 />} label="Trabajo pendiente" value={String(pending)} note="Incluye períodos sin estado" tone="gold" />
      <Metric icon={<AlertTriangle />} label="Requieren revisión" value={String(blocked)} note="Error Dig. o Rev. por Scarlen" tone="red" />
    </div>
    <div className="dashboard-grid">
      <section className="control-card span-two"><CardHead title={`F29 · ${MONTH_NAMES[month - 1]} ${year}`} subtitle="Período mensual seleccionado" action={<button onClick={() => go('f29')}>Ver dashboard <ArrowRight size={14} /></button>} />
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

function CommitInput({ value, type = 'text', className, label, onCommit }: { value: string | number | null; type?: string; className: string; label: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return <input className={className} aria-label={label} type={type} value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => { if (String(draft) !== String(value ?? '')) onCommit(String(draft)); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value ?? ''); event.currentTarget.blur(); } }} />;
}

function F29DashboardV2({ rows, updateRow, go, year, month, navigatePeriod, saveStates }: { rows: ClientRow[]; updateRow: (id: string, patch: Partial<ClientRow>) => Promise<void>; go: (s: Screen, c?: ClientRow) => void; year: number; month: number; navigatePeriod: (year: number, month: number) => void; saveStates: Record<string, 'saving' | 'saved' | 'error'> }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [responsible, setResponsible] = useState('Todos');
  const [onlyObserved, setOnlyObserved] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => setPage(1), [query, filter, responsible, onlyObserved, year, month]);
  const responsibles = [...new Set(rows.map(row => row.accountant).filter(Boolean))].sort();
  const filtered = useMemo(() => rows.filter(row =>
    (filter === 'Todos' || (filter === 'Sin período' ? !row.periodId : row.statusCode === filter)) &&
    (responsible === 'Todos' || row.accountant === responsible) &&
    (!onlyObserved || Boolean(row.observation.trim())) &&
    `${row.rut} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [rows, query, filter, responsible, onlyObserved]);
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const periodRows = rows.filter(row => row.periodId);
  const counts = Object.fromEntries((Object.keys(F29_STATUS_LABELS) as F29StatusCode[]).map(code => [code, periodRows.filter(row => row.statusCode === code).length]));
  const totalAmount = periodRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  return <div className="control-content wide-content">
    <PageHeader eyebrow="Operación mensual" title={`F29 · ${MONTH_NAMES[month - 1]} ${year}`} description="Control de declaraciones mensuales de toda la cartera." actions={<div className="period-controls"><select aria-label="Mes F29" value={month} onChange={event => navigatePeriod(year, Number(event.target.value))}>{MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select><select aria-label="Año F29" value={year} onChange={event => navigatePeriod(Number(event.target.value), month)}>{[2025, 2026, 2027].map(item => <option key={item}>{item}</option>)}</select></div>} />
    <div className="f29-kpis">
      <MiniMetric label="Total clientes" value={rows.length} /><MiniMetric label="Cargada" value={counts.A} tone="green" /><MiniMetric label="Error Dig." value={counts.B} tone="red" /><MiniMetric label="Informada" value={counts.C} tone="blue" /><MiniMetric label="Pagada / Enviada" value={counts.D} tone="green" /><MiniMetric label="Pendiente" value={counts.E} tone="gold" /><MiniMetric label="S/ Movi." value={counts.F} /><MiniMetric label="Postergado" value={counts.G} tone="gold" /><MiniMetric label="Rev. por Scarlen" value={counts.H} tone="red" /><MiniMetric label="Monto total" value={money.format(totalAmount)} tone="blue" /><MiniMetric label="Sin fecha" value={periodRows.filter(row => !row.filedDate).length} tone="gold" /><MiniMetric label="Sin período" value={rows.length - periodRows.length} tone="red" />
    </div>
    <section className="operations-card">
      <div className="table-toolbar f29-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por RUT o razón social…" /></div><select aria-label="Filtrar por estado" value={filter} onChange={event => setFilter(event.target.value)}><option value="Todos">Todos los estados</option><option value="Sin período">Sin período</option>{Object.entries(F29_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select><select aria-label="Filtrar por responsable" value={responsible} onChange={event => setResponsible(event.target.value)}><option>Todos</option>{responsibles.map(name => <option key={name}>{name}</option>)}</select><button className={`filter-button ${onlyObserved ? 'active' : ''}`} onClick={() => setOnlyObserved(value => !value)}><SlidersHorizontal size={15} /> Con observación</button></div>
      <div className="table-scroll"><table className="ops-table f29-ops-table"><thead><tr><th>RUT</th><th className="sticky-client">Razón social</th><th>Responsable</th><th>Monto</th><th>Fecha</th><th>Estado</th><th>Vence</th><th>Observación</th><th>Docs</th><th>Guardado</th></tr></thead><tbody>{shown.map(row => <tr key={row.id} className={!row.periodId ? 'missing-period-row' : ''}><td><strong>{row.rut}</strong></td><td className="sticky-client"><button className="client-cell" onClick={() => go('client', row)}><strong>{row.name}</strong>{!row.periodId && <small>Se creará al editar</small>}</button></td><td><select className="inline-select" aria-label={`Responsable de ${row.name}`} value={row.accountant} onChange={event => void updateRow(row.id, { accountant: event.target.value })}>{responsibles.map(name => <option key={name}>{name}</option>)}</select></td><td><CommitInput className="inline-number" label={`Monto de ${row.name}`} type="number" value={row.amount} onCommit={value => void updateRow(row.id, { amount: value ? Number(value) : null })} /></td><td><input className="inline-date" aria-label={`Fecha de ${row.name}`} type="date" value={row.filedDate ?? ''} onChange={event => void updateRow(row.id, { filedDate: event.target.value || null })} /></td><td><select className={`inline-status ${statusClass[row.statusLabel] ?? 'is-neutral'}`} aria-label={`Estado de ${row.name}`} value={row.statusCode ?? ''} onChange={event => { const code = event.target.value as F29StatusCode; void updateRow(row.id, { statusCode: code, statusLabel: F29_STATUS_LABELS[code] }); }}><option value="" disabled>— Sin estado</option>{Object.entries(F29_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></td><td><span className="due-day">Día {row.dueDay ?? '—'}</span></td><td><CommitInput className="inline-note" label={`Observación de ${row.name}`} value={row.observation} onCommit={value => void updateRow(row.id, { observation: value })} /></td><td><button className="document-count" onClick={() => go('client', row)}><Files size={14} />{row.documents}</button></td><td><SaveState state={saveStates[row.id]} /></td></tr>)}</tbody></table></div>
      <footer className="table-footer"><span>Mostrando {shown.length} de {filtered.length} clientes</span><span className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><b>{page} / {pageCount}</b><button disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Siguiente</button></span></footer>
    </section>
  </div>;
}

function SaveState({ state }: { state?: 'saving' | 'saved' | 'error' }) {
  if (state === 'saving') return <span className="save-state saving"><RefreshCw size={12} /> Guardando</span>;
  if (state === 'error') return <span className="save-state error"><AlertTriangle size={12} /> Error</span>;
  if (state === 'saved') return <span className="save-state saved"><Check size={12} /> Guardado</span>;
  return <span className="save-state">—</span>;
}

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

function ClientsIndexV2({ rows, go, reload }: { rows: ClientRow[]; go: (s: Screen, c?: ClientRow) => void; reload: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [responsible, setResponsible] = useState('Todos');
  const [driveFilter, setDriveFilter] = useState('Todos');
  const [editing, setEditing] = useState<ClientRow | 'new' | null>(null);
  const responsibles = [...new Set(rows.map(row => row.accountant))].sort();
  const filtered = rows.filter(row => `${row.rut} ${row.name}`.toLowerCase().includes(query.toLowerCase()) && (responsible === 'Todos' || row.accountant === responsible) && (driveFilter === 'Todos' || (driveFilter === 'Con Drive' ? Boolean(row.driveFolderId) : !row.driveFolderId)));
  const openDrive = (event: React.MouseEvent, row: ClientRow) => { event.stopPropagation(); if (row.driveFolderId) window.open(`https://drive.google.com/drive/folders/${row.driveFolderId}`, '_blank', 'noopener,noreferrer'); };
  return <div className="control-content"><PageHeader eyebrow="Base maestra" title="Clientes" description="Una vista única de la cartera activa y su cumplimiento." actions={<button className="button-dark" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo cliente</button>} /><section className="operations-card"><div className="table-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar RUT o razón social…" /></div><select value={responsible} onChange={event => setResponsible(event.target.value)}><option>Todos</option>{responsibles.map(name => <option key={name}>{name}</option>)}</select><select value={driveFilter} onChange={event => setDriveFilter(event.target.value)}><option>Todos</option><option>Con Drive</option><option>Sin Drive</option></select></div><div className="table-scroll"><table className="ops-table clients-table"><thead><tr><th>RUT</th><th>Razón social</th><th>Contador asignado</th><th>Drive</th><th>F29 actual</th><th>Docs</th><th>Última actualización</th><th /></tr></thead><tbody>{filtered.map(row => <tr key={row.id} onClick={() => go('client', row)}><td><strong>{row.rut}</strong></td><td><strong>{row.name}</strong></td><td><span className="assigned"><EmptyAvatar initials={row.initials} />{row.accountant}</span></td><td><button className="drive-button" disabled={!row.driveFolderId} onClick={event => openDrive(event, row)}><FolderOpen size={15} />{row.driveFolderId ? 'Abrir carpeta' : 'Sin carpeta'}</button></td><td><Pill value={row.statusLabel}>{row.statusLabel}</Pill></td><td>{row.documents}</td><td>{row.updated}</td><td><button className="icon-button compact" aria-label={`Editar ${row.name}`} onClick={event => { event.stopPropagation(); setEditing(row); }}><Settings size={14} /></button></td></tr>)}</tbody></table></div><footer className="table-footer"><span>{filtered.length} clientes</span><span>{rows.filter(row => row.driveFolderId).length} con carpeta Drive</span></footer></section>{editing && <ClientEditor client={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}</div>;
}

function ClientEditor({ client, onClose, onSaved }: { client?: ClientRow; onClose: () => void; onSaved: () => Promise<void> }) {
  const [rut, setRut] = useState(client?.rut ?? '');
  const [name, setName] = useState(client?.name ?? '');
  const [accountingCode, setAccountingCode] = useState(client?.accountingCode ?? '');
  const [driveFolderId, setDriveFolderId] = useState(client?.driveFolderId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!rut.trim() || !name.trim()) return setError('RUT y razón social son obligatorios.'); setSaving(true); setError(''); try { await saveClient({ rut: rut.trim(), name: name.trim(), accountingCode: accountingCode.trim(), driveFolderId: driveFolderId.trim(), isActive: true }, client?.id); await onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar el cliente.'); setSaving(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="control-modal" onSubmit={submit}><header><div><span>Base maestra</span><h2>{client ? 'Editar cliente' : 'Nuevo cliente'}</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header><label>RUT<input value={rut} onChange={event => setRut(event.target.value)} placeholder="76.123.456-7" /></label><label>Razón social<input value={name} onChange={event => setName(event.target.value)} /></label><label>Código contable<input value={accountingCode} onChange={event => setAccountingCode(event.target.value)} /></label><label>ID carpeta Google Drive<input value={driveFolderId} onChange={event => setDriveFolderId(event.target.value)} placeholder="ID, no la URL completa" /></label>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="button-ghost" onClick={onClose}>Cancelar</button><button className="button-dark" disabled={saving}><Save size={15} />{saving ? 'Guardando…' : 'Guardar cliente'}</button></footer></form></div>;
}

type ProfileTab = 'Resumen' | 'F29 mensual' | 'Renta / F22' | 'Documentos' | 'Observaciones' | 'Actividad';

function ClientProfileV2({ client, year, month, reload }: { client: ClientRow; year: number; month: number; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<ProfileTab>('Resumen');
  const [history, setHistory] = useState<PeriodHistory[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [observations, setObservations] = useState<ClientObservation[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const refresh = async () => { setLoading(true); setLoadError(''); try { const [nextHistory, nextDocuments, nextObservations, nextActivity] = await Promise.all([loadClientHistory(client.id), loadClientDocuments(client.id), loadClientObservations(client.id), loadClientActivity(client.id)]); setHistory(nextHistory); setDocuments(nextDocuments); setObservations(nextObservations); setActivity(nextActivity); } catch (error) { setLoadError(error instanceof Error ? error.message : 'No fue posible cargar toda la ficha.'); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, [client.id]);
  const openDrive = () => { if (client.driveFolderId) window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank', 'noopener,noreferrer'); };
  return <div className="control-content"><div className="client-profile-head"><div className="client-monogram">{client.name.charAt(0)}</div><div><span>Cliente activo</span><h1>{client.name}</h1><p>{client.rut} · {client.accountant}</p></div><div className="page-actions"><button className="button-ghost" disabled={!client.driveFolderId} onClick={openDrive}><FolderOpen size={16} />{client.driveFolderId ? 'Abrir Drive' : 'Sin carpeta Drive'}</button><button className="button-dark" onClick={() => setEditing(true)}>Editar cliente</button></div></div><nav className="profile-tabs">{(['Resumen', 'F29 mensual', 'Renta / F22', 'Documentos', 'Observaciones', 'Actividad'] as ProfileTab[]).map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}{item === 'Documentos' && <em>{documents.length}</em>}</button>)}</nav>{loadError && <div className="control-data-state is-error"><AlertTriangle size={16} />{loadError}</div>}{loading ? <div className="control-data-state">Cargando ficha del cliente…</div> : tab === 'Resumen' ? <ClientSummaryV2 client={client} history={history} year={year} month={month} observations={observations} /> : tab === 'F29 mensual' ? <HistoryPanel history={history} /> : tab === 'Renta / F22' ? <EmptyPanel title="Renta / F22" text="La estructura anual está preparada; todavía no hay datos F22 cargados para este cliente." /> : tab === 'Documentos' ? <DocumentsPanel client={client} documents={documents} refresh={refresh} /> : tab === 'Observaciones' ? <ObservationsPanel client={client} observations={observations} refresh={refresh} /> : <ActivityPanelV2 client={client} activity={activity} />}{editing && <ClientEditor client={client} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await reload(); }} />}</div>;
}

function ClientSummaryV2({ client, history, year, month, observations }: { client: ClientRow; history: PeriodHistory[]; year: number; month: number; observations: ClientObservation[] }) {
  return <div className="profile-grid"><section className="control-card"><CardHead title={`F29 · ${MONTH_NAMES[month - 1]} ${year}`} subtitle="Período actual" /><div className="profile-status"><Pill value={client.statusLabel}>{client.statusLabel}</Pill><strong>{client.amount === null ? '—' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(client.amount)}</strong><span>{client.filedDate ? `Presentado ${shortDate(client.filedDate)}` : 'Fecha pendiente'}</span></div></section><section className="control-card"><CardHead title="Renta · AT 2026" subtitle="Estructura preparada" /><div className="profile-status"><Pill value="Pendiente">Próxima temporada</Pill><strong>—</strong><span>sin datos anuales todavía</span></div></section><section className="control-card span-two"><CardHead title="Historial F29" subtitle={`${history.length} períodos registrados`} /><HistoryGrid history={history.slice(0, 6)} /></section><section className="control-card span-two"><CardHead title="Observaciones" subtitle="Notas operativas del equipo" /><div className="observation-box"><EmptyAvatar initials={client.initials} /><div><strong>{observations[0]?.author ?? client.accountant}</strong><p>{observations[0]?.body || client.observation || 'Cliente al día. Sin observaciones pendientes.'}</p><small>{observations[0] ? dateTime(observations[0].createdAt) : `Actualizado ${client.updated.toLowerCase()}`}</small></div></div></section></div>;
}

function HistoryGrid({ history }: { history: PeriodHistory[] }) { const names = MONTH_NAMES.map(name => name.slice(0, 3)); return <>{history.length ? <div className="history-row">{history.map(period => <div key={period.id}><span>{names[period.month - 1]} {String(period.year).slice(-2)}</span><i className={period.status_code === 'B' || period.status_code === 'H' ? 'blocked' : 'done'}>{period.status_code ?? '—'}</i><small>{period.status_label ?? 'Sin estado'}</small></div>)}</div> : <p className="empty-history">Sin períodos F29 registrados.</p>}</>; }

function HistoryPanel({ history }: { history: PeriodHistory[] }) { return <section className="operations-card"><div className="documents-head"><div><h2>Historial F29</h2><p>Todos los períodos mensuales disponibles.</p></div></div><div className="table-scroll"><table className="ops-table"><thead><tr><th>Período</th><th>Estado</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>{history.map(item => <tr key={item.id}><td><strong>{MONTH_NAMES[item.month - 1]} {item.year}</strong></td><td><Pill value={item.status_label ?? 'Sin estado'}>{item.status_label ?? 'Sin estado'}</Pill></td><td>{item.amount === null ? '—' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(item.amount))}</td><td>{shortDate(item.filed_date)}</td></tr>)}</tbody></table></div></section>; }

function EmptyPanel({ title, text }: { title: string; text: string }) { return <section className="control-card empty-panel"><FileSpreadsheet size={28} /><h2>{title}</h2><p>{text}</p></section>; }

const DOCUMENT_LABELS: Record<DocumentKind, string> = { f29: 'F29', rcv: 'RCV', bce: 'BCE', f22: 'F22', dj_1948: 'DJ 1948', dj_1949: 'DJ 1949', other: 'Otro' };

function DocumentsPanel({ client, documents, refresh }: { client: ClientRow; documents: ClientDocument[]; refresh: () => Promise<void> }) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [needsDriveAuthorization, setNeedsDriveAuthorization] = useState(false);
  const scan = async () => { setScanning(true); setMessage(''); setNeedsDriveAuthorization(false); try { const result = await scanClientDrive(client.id); setMessage(`${result.files_found} archivos encontrados · ${result.new_files} nuevos · ${result.updated_files} actualizados`); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error al escanear Drive.'); setNeedsDriveAuthorization(error instanceof DriveAuthorizationError); } finally { setScanning(false); } };
  const classify = async (document: ClientDocument, type: DocumentKind) => { setMessage('Guardando clasificación…'); try { await classifyDocument(document.id, type); await refresh(); setMessage('Clasificación guardada.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible clasificar el documento.'); } };
  return <section className="operations-card documents-panel"><div className="documents-head"><div><h2>Documentos en Google Drive</h2><p>{client.driveFolderId ? 'Archivos sincronizados con el acceso Google del empleado.' : 'Agrega un ID de carpeta Drive para habilitar la sincronización.'}</p>{message && <small className={`operation-message ${needsDriveAuthorization ? 'is-warning' : ''}`}>{message}</small>}</div>{needsDriveAuthorization ? <button className="button-dark" onClick={() => void connectGoogleDrive()}><ShieldCheck size={16} /> Autorizar Google Drive</button> : <button className="button-dark" disabled={scanning || !client.driveFolderId} onClick={() => void scan()}><Cloud size={16} />{scanning ? 'Escaneando…' : 'Escanear carpeta'}</button>}</div><div className="table-scroll"><table className="ops-table"><thead><tr><th>Archivo</th><th>Tipo</th><th>Modificado</th><th>Estado</th><th /></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td><span className="file-name"><FileSpreadsheet size={18} /><span><strong>{doc.name}</strong><small>{doc.mimeType ?? 'Tipo desconocido'}</small></span></span></td><td><select className="inline-select" value={doc.type} onChange={event => void classify(doc, event.target.value as DocumentKind)}>{(Object.keys(DOCUMENT_LABELS) as DocumentKind[]).map(type => <option key={type} value={type}>{DOCUMENT_LABELS[type]}</option>)}</select></td><td>{doc.modifiedAt ? dateTime(doc.modifiedAt) : '—'}</td><td><Pill value={doc.processingStatus === 'classified' ? 'Listo' : 'Pendiente'}>{doc.processingStatus === 'classified' ? 'Clasificado' : 'Sin clasificar'}</Pill></td><td>{doc.driveUrl && <a className="drive-button" href={doc.driveUrl} target="_blank" rel="noreferrer">Abrir en Drive <ExternalLink size={13} /></a>}</td></tr>)}</tbody></table>{!documents.length && <div className="empty-table">Todavía no hay documentos sincronizados.</div>}</div></section>;
}

function ObservationsPanel({ client, observations, refresh }: { client: ClientRow; observations: ClientObservation[]; refresh: () => Promise<void> }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!body.trim()) return; setSaving(true); try { await addClientObservation(client.id, body.trim()); setBody(''); await refresh(); } finally { setSaving(false); } };
  return <section className="control-card notes-panel"><CardHead title="Observaciones" subtitle="Notas internas auditables" /><form className="observation-form" onSubmit={submit}><textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Agregar una observación para el equipo…" /><button className="button-dark" disabled={saving || !body.trim()}><Plus size={15} />{saving ? 'Guardando…' : 'Agregar observación'}</button></form><ul className="notes-list">{observations.map(note => <li key={note.id}><EmptyAvatar initials={note.author.split(/\s+/).map(part => part[0]).join('').slice(0, 2)} /><div><strong>{note.author}</strong><p>{note.body}</p><small>{dateTime(note.createdAt)}</small></div></li>)}</ul>{!observations.length && <div className="empty-table">No hay observaciones registradas.</div>}</section>;
}

const ACTIVITY_LABELS: Record<string, string> = { f29_period_updated: 'Período F29 actualizado', drive_scan: 'Carpeta Drive escaneada', document_classified: 'Documento clasificado', observation_added: 'Observación agregada', client_updated: 'Ficha del cliente actualizada', client_created: 'Cliente creado' };
function ActivityPanelV2({ client, activity }: { client: ClientRow; activity: ActivityEntry[] }) { return <section className="control-card activity-panel"><CardHead title="Historial de actividad" subtitle={`Trazabilidad completa de ${client.name}`} /><ul className="timeline">{activity.map(item => <li key={item.id}><span><Check size={14} /></span><div><strong>{ACTIVITY_LABELS[item.action] ?? item.action}</strong><p>{item.actor} · {dateTime(item.createdAt)}</p></div></li>)}</ul>{!activity.length && <div className="empty-table">No hay actividad registrada para este cliente.</div>}</section>; }
