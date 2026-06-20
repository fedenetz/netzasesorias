import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Activity, AlertTriangle, ArrowRight, Bell, Building2, CalendarDays, Check, ChevronDown,
  ChevronsUpDown, CircleDollarSign, Clock3, Cloud, FileSpreadsheet, Files, FolderOpen,
  LayoutDashboard, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, SlidersHorizontal,
  Users, X, Plus, Save, ExternalLink, RefreshCw, Mail,
} from 'lucide-react';
import { clients as seedClients, docs } from './data';
import { F29_STATUS_LABELS, type ActivityEntry, type ClientBillingSummary, type ClientDocument, type ClientObservation, type ClientRow, type DocumentKind, type F22Row, type F29StatusCode } from './types';
import { persistF29Change } from './f29-api';
import { loadAdminRows, loadClientHistory, type PeriodHistory } from './f29-data';
import { loadClientF22, loadF22Rows, persistF22Change } from './f22-data';
import { addClientObservation, classifyDocument, DriveAuthorizationError, loadClientActivity, loadClientBillingSummary, loadClientDocuments, loadClientObservations, loadServicePlans, saveClient, scanClientDrive, updateClientPlan } from './client-api';
import { connectGoogleDrive, supabase } from './supabase';
import { BillingDetailsModal, ClientContactsPanel, EmailStatusBadge, StatusBadge } from './billing-ui';
import { BillingDashboard } from './BillingDashboard';
import { F29MailComposer as EmailComposer } from './F29MailComposer';
import { effectiveBillingStatus } from './billing-utils';
import { F29OperationsDashboard } from './f29-operations-ui';
import { AdminSettings } from './AdminSettings';
import { ActivityWorkspace, DocumentsWorkspace } from './OperationsScreens';

type Screen = 'dashboard' | 'clients' | 'f29' | 'f22' | 'billing' | 'documents' | 'activity' | 'settings' | 'client';

const nav = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'f29', label: 'F29 mensual', icon: CalendarDays },
  { id: 'f22', label: 'Renta / F22', icon: FileSpreadsheet },
  { id: 'billing', label: 'Facturación', icon: CircleDollarSign },
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

export function AdminApp({ user, preview, role }: { user: User | null; preview: boolean; role: 'admin' | 'accountant' | 'viewer' }) {
  const initialPath = window.location.pathname;
  const periodMatch = initialPath.match(/\/f29\/(\d{4})\/(\d{1,2})/);
  const initialYear = periodMatch ? Number(periodMatch[1]) : 2026;
  const initialMonth = periodMatch ? Number(periodMatch[2]) : 5;
  const [activeYear, setActiveYear] = useState(initialYear);
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [screen, setScreen] = useState<Screen>(initialPath.includes('/f29') ? 'f29' : initialPath.includes('/f22') ? 'f22' : initialPath.includes('/billing') ? 'billing' : initialPath.includes('/documents') ? 'documents' : initialPath.includes('/activity') ? 'activity' : initialPath.includes('/settings') ? 'settings' : initialPath.includes('/clients/') ? 'client' : initialPath.endsWith('/clients') ? 'clients' : 'dashboard');
  const [rows, setRows] = useState<ClientRow[]>(preview ? seedClients : []);
  const [selected, setSelected] = useState<ClientRow | null>(preview ? seedClients[0] : null);
  const [dataLoading, setDataLoading] = useState(!preview);
  const [dataError, setDataError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (preview) return;
    loadAdminRows(activeYear, activeMonth, role === 'admin').then(liveRows => {
      setRows(liveRows);
      const routeRut = decodeURIComponent(window.location.pathname.replace('/clients/', ''));
      setSelected(liveRows.find(row => row.rut === routeRut) ?? liveRows[0] ?? null);
      setDataLoading(false);
    }).catch(error => {
      setDataError(error instanceof Error ? error.message : 'No fue posible cargar los datos de Supabase.');
      setDataLoading(false);
    });
  }, [activeMonth, activeYear, preview, role]);

  const go = (next: Screen, client?: ClientRow) => {
    if (client) setSelected(client);
    setScreen(next);
    const paths: Record<Screen, string> = { dashboard: '/control', clients: '/clients', f29: `/f29/${activeYear}/${String(activeMonth).padStart(2, '0')}`, f22: '/f22/2026', billing: '/billing', documents: '/documents', activity: '/activity', settings: '/settings', client: `/clients/${client?.rut ?? selected?.rut ?? ''}` };
    window.history.pushState({}, '', paths[next]);
    setSidebarOpen(false);
  };

  const navigatePeriod = (year: number, month: number) => {
    setActiveYear(year); setActiveMonth(month); setScreen('f29');
    window.history.pushState({}, '', `/f29/${year}/${String(month).padStart(2, '0')}`);
  };

  const reloadRows = async () => {
    if (preview) return;
    const liveRows = await loadAdminRows(activeYear, activeMonth, role === 'admin');
    setRows(liveRows);
    setSelected(current => current ? liveRows.find(row => row.id === current.id) ?? current : liveRows[0] ?? null);
  };

  const updateRow = async (id: string, patch: Partial<ClientRow>) => {
    const row = rows.find(item => item.id === id);
    if (!row) return;
    const effectivePatch: Partial<ClientRow> = patch.taxPaid === true ? { ...patch, statusCode: 'D', statusLabel: F29_STATUS_LABELS.D } : patch.taxPaid === false && row.statusCode === 'D' ? { ...patch, statusCode: row.emailStatus === 'sent' ? 'C' : 'A', statusLabel: row.emailStatus === 'sent' ? F29_STATUS_LABELS.C : F29_STATUS_LABELS.A } : patch;
    if (preview) {
      setRows(current => current.map(item => item.id === id ? { ...item, ...effectivePatch, updated: 'Ahora' } : item));
      setSaveStates(current => ({ ...current, [id]: 'saved' }));
      return;
    }
    setSaveStates(current => ({ ...current, [id]: 'saving' }));
    setRows(current => current.map(item => item.id === id ? { ...item, ...effectivePatch, updated: 'Ahora' } : item));
    try {
      const periodId = await persistF29Change(row, effectivePatch);
      setRows(current => current.map(item => item.id === id ? { ...item, ...effectivePatch, periodId, updated: 'Ahora' } : item));
      setSaveStates(current => ({ ...current, [id]: 'saved' }));
    } catch (error) {
      console.error('No se pudo guardar el cambio F29', error);
      setRows(current => current.map(item => item.id === id ? row : item));
      setSaveStates(current => ({ ...current, [id]: 'error' }));
    }
  };
  const displayName = String(user?.user_metadata?.full_name ?? 'Camila Soto');
  const [globalSearch, setGlobalSearch] = useState('');
  const searchMatches = globalSearch.trim() ? rows.filter(row => `${row.name} ${row.rut} ${row.accountingCode ?? ''}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0, 6) : [];
  const signOut = async () => { setLogoutOpen(false); await supabase?.auth.signOut(); };

  if (role === 'viewer') return <ViewerWorkspace rows={rows} loading={dataLoading} error={dataError} displayName={displayName} signOut={signOut} />;

  return (
    <div className="control-shell">
      <aside className={`control-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><span><img src="/brand/icono-blanco.png" alt="" /><strong>NETZ</strong></span><button onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <div className="workspace-switch"><span className="workspace-icon">N</span><span><strong>Netz Asesorías</strong><small>Operaciones</small></span><ChevronsUpDown size={15} /></div>
        <nav className="control-nav" aria-label="Operaciones">
          <p>Principal</p>
          {nav.map(item => <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => go(item.id)}><item.icon size={18} />{item.label}{item.id === 'f29' && <em>{rows.filter(row => row.f29Enabled && row.periodId).length}</em>}</button>)}
          <p>Gestión</p>
          <button className={screen === 'documents' ? 'active' : ''} onClick={() => go('documents')}><Files size={18} />Documentos</button>
          <button className={screen === 'activity' ? 'active' : ''} onClick={() => go('activity')}><Activity size={18} />Actividad</button>
        </nav>
        <div className="sidebar-bottom">
          {role === 'admin' && <button className={screen === 'settings' ? 'active' : ''} onClick={() => go('settings')}><Settings size={18} />Configuración</button>}
          <div className="secure-note"><ShieldCheck size={17} /><span><strong>Entorno seguro</strong><small>Acceso solo empleados</small></span></div>
        </div>
      </aside>
      <main className="control-main">
        <header className="control-topbar">
          <button className="mobile-sidebar" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-search global-search"><Search size={17} /><input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Buscar cliente, RUT o Conta…" />{searchMatches.length > 0 && <div className="global-search-results">{searchMatches.map(row => <button key={row.id} onClick={() => { setGlobalSearch(''); go('client', row); }}><strong>{row.name}</strong><small>{row.rut} · Conta {row.accountingCode ?? '—'}</small></button>)}</div>}</div>
          <div className="topbar-actions">
            {preview && <span className="preview-badge">Vista local</span>}
            <button className="icon-button" aria-label="Ver actividad" onClick={() => go('activity')}><Bell size={18} /></button>
            <button className="user-menu" onClick={() => setLogoutOpen(true)} title="Cerrar sesión"><EmptyAvatar initials={displayName.split(' ').map(value => value[0]).join('').slice(0,2).toUpperCase()} /><span><strong>{displayName}</strong><small>{role === 'admin' ? 'Administrador' : role === 'accountant' ? 'Contador' : 'Solo lectura'}</small></span><LogOut size={15} /></button>
          </div>
        </header>
        {dataLoading && <div className="control-data-state">Cargando datos de Supabase…</div>}
        {dataError && <div className="control-data-state is-error"><AlertTriangle size={18} />{dataError}</div>}
        {!dataLoading && !dataError && screen === 'dashboard' && <Dashboard rows={rows} go={go} year={activeYear} month={activeMonth} />}
        {!dataLoading && !dataError && screen === 'f29' && <F29OperationsDashboard rows={rows.filter(row => row.f29Enabled)} updateRow={updateRow} openClient={row => go('client', row)} year={activeYear} month={activeMonth} navigatePeriod={navigatePeriod} saveStates={saveStates} reload={reloadRows} isAdmin={role === 'admin'} />}
        {!dataLoading && !dataError && screen === 'f22' && <F22DashboardLive initialTaxYear={Number(initialPath.match(/\/f22\/(\d{4})/)?.[1] ?? 2026)} openClient={clientId => { const client = rows.find(row => row.id === clientId); if (client) go('client', client); }} />}
        {!dataLoading && !dataError && screen === 'clients' && <ClientsIndexV3 rows={rows} go={go} reload={reloadRows} />}
        {!dataLoading && !dataError && screen === 'billing' && <BillingDashboard openClient={clientId => { const client = rows.find(row => row.id === clientId); if (client) go('client', client); }} />}
        {!dataLoading && !dataError && screen === 'documents' && <DocumentsWorkspace />}
        {!dataLoading && !dataError && screen === 'activity' && <ActivityWorkspace />}
        {!dataLoading && !dataError && screen === 'settings' && role === 'admin' && <AdminSettings preview={preview} />}
        {!dataLoading && !dataError && screen === 'client' && selected && <ClientProfileV2 client={selected} year={activeYear} month={activeMonth} reload={reloadRows} />}
        {logoutOpen && <div className="modal-backdrop"><section className="control-modal logout-confirm"><header><div><span>Sesión segura</span><h2>¿Cerrar sesión?</h2></div><button aria-label="Cancelar cierre" onClick={() => setLogoutOpen(false)}><X size={18}/></button></header><p>Saldrás del panel interno de Netz. Los cambios ya guardados permanecerán registrados.</p><footer><button className="button-ghost" onClick={() => setLogoutOpen(false)}>Cancelar</button><button className="button-danger" onClick={() => void signOut()}><LogOut size={14}/> Cerrar sesión</button></footer></section></div>}
      </main>
    </div>
  );
}

function ViewerWorkspace({ rows, loading, error, displayName, signOut }: { rows: ClientRow[]; loading: boolean; error: string; displayName: string; signOut: () => Promise<void> }) {
  const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  return <div className="control-shell viewer-workspace"><main className="control-main"><header className="control-topbar"><div><strong>Netz Control</strong><small className="viewer-label">Vista de solo lectura</small></div><button className="button-ghost" onClick={() => void signOut()}><LogOut size={14}/> Cerrar sesión</button></header><div className="control-content wide-content"><div className="control-page-head"><div><span>Acceso viewer</span><h1>Operación contable</h1><p>{displayName}, puedes consultar el estado operativo. Las ediciones, envíos, cobros, contactos, adjuntos y acciones de Drive están deshabilitados para tu rol.</p></div></div>{loading && <div className="control-data-state">Cargando datos de Supabase…</div>}{error && <div className="control-data-state is-error"><AlertTriangle size={18}/>{error}</div>}{!loading && !error && <section className="operations-card"><div className="table-scroll"><table className="ops-table"><thead><tr><th>Cliente</th><th>RUT</th><th>Responsable</th><th>F29</th><th>Monto</th><th>Fecha</th><th>Email</th><th>Pago</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.rut}</td><td>{row.accountant || '—'}</td><td><Pill value={row.statusLabel}>{row.statusLabel || 'Sin estado'}</Pill></td><td>{row.amount == null ? '—' : money.format(row.amount)}</td><td>{row.filedDate || '—'}</td><td><EmailStatusBadge status={row.emailStatus}/></td><td>{row.taxPaid ? 'Pagado' : 'Pendiente'}</td></tr>)}</tbody></table>{!rows.length && <div className="empty-table">No hay clientes visibles.</div>}</div></section>}</div></main></div>;
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
      <F22OverviewCard taxYear={2026} go={go} />
      <section className="control-card span-two"><CardHead title="Atención requerida" subtitle="Clientes con bloqueos o atrasos" action={<button>Ver todos</button>} />
        <div className="attention-list">{rows.filter(r => ['B', 'E', 'H'].includes(r.statusCode ?? '')).slice(0, 3).map(r => <button key={r.id} onClick={() => go('client', r)}><EmptyAvatar initials={r.initials} /><span><strong>{r.name}</strong><small>{r.observation || 'Declaración aún no iniciada'}</small></span><Pill value={r.statusLabel}>{r.statusLabel}</Pill><ArrowRight size={16} /></button>)}</div>
      </section>
      <section className="control-card"><CardHead title="Datos sincronizados" subtitle="Supabase · período actual" /><ul className="activity-feed"><li><span className="activity-system"><Cloud size={15} /></span><span><strong>{rows.length} clientes cargados</strong><small>{periods.length} períodos F29 disponibles</small></span></li><li><span className="activity-system"><ShieldCheck size={15} /></span><span><strong>Credenciales excluidas</strong><small>Solo metadatos operacionales</small></span></li></ul></section>
    </div>
  </div>;
}

function F22OverviewCard({ taxYear, go }: { taxYear: number; go: (screen: Screen) => void }) {
  const [rows, setRows] = useState<F22Row[]>([]);
  useEffect(() => { void loadF22Rows(taxYear).then(setRows).catch(() => setRows([])); }, [taxYear]);
  const sent = rows.filter(row => row.f22Sent).length;
  const completion = rows.length ? Math.round(sent / rows.length * 100) : 0;
  return <section className="control-card"><CardHead title={`Renta · AT ${taxYear}`} subtitle="Operación anual" action={<button onClick={() => go('f22')}>Ver dashboard <ArrowRight size={14} /></button>} /><div className="annual-score"><span>{completion}%</span><strong>{sent} de {rows.length} F22 enviados</strong><div><i style={{ width: `${completion}%` }} /></div><small>{rows.length - sent} declaraciones pendientes</small></div></section>;
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

function F29DashboardV2({ rows, updateRow, go, year, month, navigatePeriod, saveStates, reload }: { rows: ClientRow[]; updateRow: (id: string, patch: Partial<ClientRow>) => Promise<void>; go: (s: Screen, c?: ClientRow) => void; year: number; month: number; navigatePeriod: (year: number, month: number) => void; saveStates: Record<string, 'saving' | 'saved' | 'error'>; reload: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [responsible, setResponsible] = useState('Todos');
  const [onlyObserved, setOnlyObserved] = useState(false);
  const [billingFilter, setBillingFilter] = useState<'all' | 'email' | 'pending' | 'overdue' | 'paid'>('all');
  const [emailRow, setEmailRow] = useState<ClientRow | null>(null);
  const [billingRow, setBillingRow] = useState<ClientRow | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => setPage(1), [query, filter, responsible, onlyObserved, billingFilter, year, month]);
  const responsibles = [...new Set(rows.map(row => row.accountant).filter(Boolean))].sort();
  const filtered = useMemo(() => rows.filter(row =>
    (filter === 'Todos' || (filter === 'Sin período' ? !row.periodId : row.statusCode === filter)) &&
    (responsible === 'Todos' || row.accountant === responsible) &&
    (!onlyObserved || Boolean(row.observation.trim())) &&
    (billingFilter === 'all' || (billingFilter === 'email' && row.emailStatus !== 'sent') || (billingFilter === 'pending' && ['pending', 'sent'].includes(row.billingStatus)) || (billingFilter === 'overdue' && effectiveBillingStatus(row.billingStatus, row.billingDueDate, row.paidAt) === 'overdue') || (billingFilter === 'paid' && row.billingStatus === 'paid')) &&
    `${row.rut} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [rows, query, filter, responsible, onlyObserved, billingFilter]);
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
      <div className="table-toolbar f29-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por RUT o razón social…" /></div><select aria-label="Filtrar por estado" value={filter} onChange={event => setFilter(event.target.value)}><option value="Todos">Todos los estados</option><option value="Sin período">Sin período</option>{Object.entries(F29_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select><select aria-label="Filtrar por responsable" value={responsible} onChange={event => setResponsible(event.target.value)}><option>Todos</option>{responsibles.map(name => <option key={name}>{name}</option>)}</select><select aria-label="Filtro de comunicación y cobro" value={billingFilter} onChange={event => setBillingFilter(event.target.value as typeof billingFilter)}><option value="all">Email y cobro: todos</option><option value="email">Email no enviado</option><option value="pending">Cobro pendiente</option><option value="overdue">Vencido</option><option value="paid">Pagado</option></select><button className={`filter-button ${onlyObserved ? 'active' : ''}`} onClick={() => setOnlyObserved(value => !value)}><SlidersHorizontal size={15} /> Con observación</button></div>
      <div className="table-scroll"><table className="ops-table f29-ops-table billing-extended"><thead><tr><th>RUT</th><th className="sticky-client">Razón social</th><th>Responsable</th><th>Monto F29</th><th>Fecha</th><th>Estado F29</th><th>Email</th><th>Cobro</th><th>Pagado</th><th>Monto cobro</th><th>Fecha pago</th><th>Acciones</th><th>Guardado</th></tr></thead><tbody>{shown.map(row => { const effective = effectiveBillingStatus(row.billingStatus, row.billingDueDate, row.paidAt); return <tr key={row.id} className={!row.periodId ? 'missing-period-row' : ''}><td><strong>{row.rut}</strong></td><td className="sticky-client"><button className="client-cell" onClick={() => go('client', row)}><strong>{row.name}</strong>{!row.periodId && <small>Se creará al editar</small>}</button></td><td><select className="inline-select" aria-label={`Responsable de ${row.name}`} value={row.accountant} onChange={event => void updateRow(row.id, { accountant: event.target.value })}>{responsibles.map(name => <option key={name}>{name}</option>)}</select></td><td><CommitInput className="inline-number" label={`Monto F29 de ${row.name}`} type="number" value={row.amount} onCommit={value => void updateRow(row.id, { amount: value ? Number(value) : null })} /></td><td><input className="inline-date" aria-label={`Fecha de ${row.name}`} type="date" value={row.filedDate ?? ''} onChange={event => void updateRow(row.id, { filedDate: event.target.value || null })} /></td><td><select className={`inline-status ${statusClass[row.statusLabel] ?? 'is-neutral'}`} aria-label={`Estado de ${row.name}`} value={row.statusCode ?? ''} onChange={event => { const code = event.target.value as F29StatusCode; void updateRow(row.id, { statusCode: code, statusLabel: F29_STATUS_LABELS[code] }); }}><option value="" disabled>— Sin estado</option>{Object.entries(F29_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></td><td><EmailStatusBadge status={row.emailStatus} /></td><td><StatusBadge status={effective} /></td><td><Checkbox value={row.billingStatus === 'paid'} label={`Marcar pago de ${row.name}`} onChange={() => row.periodId && void updateRow(row.id, { billingStatus: row.billingStatus === 'paid' ? 'pending' : 'paid', paidAt: row.billingStatus === 'paid' ? null : new Date().toISOString() })} /></td><td><CommitInput className="inline-number" label={`Monto de cobro de ${row.name}`} type="number" value={row.billingAmount} onCommit={value => row.periodId && void updateRow(row.id, { billingAmount: value ? Number(value) : 0, billingStatus: row.billingStatus === 'not_applicable' ? 'pending' : row.billingStatus })} /></td><td><input className="inline-date" type="date" disabled={row.billingStatus !== 'paid'} value={row.paidAt?.slice(0, 10) ?? ''} onChange={event => void updateRow(row.id, { paidAt: event.target.value ? `${event.target.value}T12:00:00.000Z` : null })} /></td><td><div className="row-actions"><button disabled={!row.periodId} title={!row.periodId ? 'Crea el período antes de enviar' : ''} onClick={() => setEmailRow(row)}><Mail size={13} /> Preparar email</button><button disabled={!row.periodId} onClick={() => setBillingRow(row)}><CircleDollarSign size={13} /> Detalle</button></div></td><td><SaveState state={saveStates[row.id]} /></td></tr>; })}</tbody></table></div>
      <footer className="table-footer"><span>Mostrando {shown.length} de {filtered.length} clientes</span><span className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><b>{page} / {pageCount}</b><button disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Siguiente</button></span></footer>
    </section>{emailRow && <EmailComposer row={emailRow} onClose={() => setEmailRow(null)} onSent={reload} />}{billingRow && <BillingDetailsModal row={billingRow} onClose={() => setBillingRow(null)} onSaved={reload} />}
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

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const f22Amount = (amount: number | null, textValue: string) => amount === null ? textValue || '—' : clp.format(amount);

function F22DashboardLive({ initialTaxYear, openClient }: { initialTaxYear: number; openClient: (clientId: string) => void }) {
  const [taxYear, setTaxYear] = useState(initialTaxYear);
  const [rows, setRows] = useState<F22Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [onlyObserved, setOnlyObserved] = useState(false);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const pageSize = 100;
  const load = async (year: number) => { setLoading(true); setError(''); try { setRows(await loadF22Rows(year)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cargar Renta/F22.'); } finally { setLoading(false); } };
  useEffect(() => { void load(taxYear); }, [taxYear]);
  useEffect(() => setPage(1), [query, filter, onlyObserved, taxYear]);
  const changeYear = (year: number) => { setTaxYear(year); window.history.pushState({}, '', `/f22/${year}`); };
  const update = async (row: F22Row, patch: Partial<F22Row>) => {
    setSaving(current => ({ ...current, [row.id]: 'saving' }));
    setRows(current => current.map(item => item.id === row.id ? { ...item, ...patch } : item));
    try { await persistF22Change(row, patch); setSaving(current => ({ ...current, [row.id]: 'saved' })); }
    catch (reason) { setRows(current => current.map(item => item.id === row.id ? row : item)); setSaving(current => ({ ...current, [row.id]: 'error' })); setError(reason instanceof Error ? reason.message : 'No fue posible guardar el cambio.'); }
  };
  const filtered = useMemo(() => rows.filter(row => `${row.rut} ${row.name}`.toLowerCase().includes(query.toLowerCase()) && (!onlyObserved || Boolean(row.observation)) && (filter === 'Todos' || (filter === 'BCE pendiente' && !row.bceDate) || (filter === 'F22 pendiente' && !row.f22Sent) || (filter === 'F22 enviado' && row.f22Sent) || (filter === 'DJ pendiente' && row.dj1948 === true && !row.dj1948Sent))), [rows, query, filter, onlyObserved]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const bceLoaded = rows.filter(row => row.bceDate).length;
  const f22Ready = rows.filter(row => row.f22Ready).length;
  const f22Sent = rows.filter(row => row.f22Sent).length;
  const djSent = rows.filter(row => row.dj1948Sent).length;
  const refundTotal = rows.reduce((sum, row) => sum + (row.refundAmount ?? 0), 0);
  const paymentTotal = rows.reduce((sum, row) => sum + (row.paymentAmount ?? 0), 0);
  return <div className="control-content wide-content"><PageHeader eyebrow="Operación anual" title={`Renta · Año Tributario ${taxYear}`} description="Control anual normalizado desde la planilla operativa del equipo." actions={<select className="period-button" aria-label="Año tributario" value={taxYear} onChange={event => changeYear(Number(event.target.value))}>{[2025, 2026, 2027].map(year => <option key={year}>{year}</option>)}</select>} />{error && <div className="control-data-state is-error"><AlertTriangle size={17} />{error}</div>}{loading ? <div className="control-data-state">Cargando operación Renta/F22…</div> : <><div className="f22-kpis"><MiniMetric label="Clientes" value={rows.length} /><MiniMetric label="BCE cargados" value={bceLoaded} tone="green" /><MiniMetric label="RN / F22 listos" value={f22Ready} tone="blue" /><MiniMetric label="F22 enviados" value={f22Sent} tone="green" /><MiniMetric label="DJ 1948 enviadas" value={djSent} tone="blue" /><MiniMetric label="F22 pendientes" value={rows.length - f22Sent} tone="gold" /><MiniMetric label="Devoluciones" value={clp.format(refundTotal)} tone="green" /><MiniMetric label="Pagos" value={clp.format(paymentTotal)} tone="red" /><MiniMetric label="Con observación" value={rows.filter(row => row.observation).length} /></div><section className="operations-card"><div className="table-toolbar f29-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por RUT o cliente…" /></div><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todos</option><option>BCE pendiente</option><option>F22 pendiente</option><option>F22 enviado</option><option>DJ pendiente</option></select><button className={`filter-button ${onlyObserved ? 'active' : ''}`} onClick={() => setOnlyObserved(value => !value)}><SlidersHorizontal size={15} /> Con observación</button></div><div className="table-scroll"><table className="ops-table f22-live-table"><thead><tr><th>RUT</th><th className="sticky-client">Cliente</th><th>Régimen</th><th>Fecha BCE</th><th>BCE</th><th>RN / F22</th><th>F22 enviado</th><th>DJ 1948</th><th>DJ enviada</th><th>DJ 1949</th><th>Provisorio</th><th>Utilidad / Pérdida</th><th>Retiros / Dividendos</th><th>Observaciones</th><th>Responsable</th><th>Guardado</th></tr></thead><tbody>{shown.map(row => <tr key={row.id}><td><strong>{row.rut}</strong></td><td className="sticky-client"><button className="client-cell" onClick={() => openClient(row.clientId)}><strong>{row.name}</strong></button></td><td>{row.taxRegime || '—'}{row.regimeDetail && <small className="block-rut">{row.regimeDetail}</small>}</td><td><input className="inline-date" type="date" value={row.bceDate ?? ''} aria-label={`Fecha BCE de ${row.name}`} onChange={event => void update(row, { bceDate: event.target.value || null, bceStatus: event.target.value ? 'Cargado' : 'Pendiente' })} /></td><td><Pill value={row.bceDate ? 'Listo' : 'Pendiente'}>{row.bceDate ? 'Cargado' : 'Pendiente'}</Pill></td><td><Checkbox value={Boolean(row.f22Ready)} label={`RN F22 de ${row.name}`} onChange={() => void update(row, { f22Ready: !row.f22Ready })} /></td><td><Checkbox value={row.f22Sent} label={`F22 enviado de ${row.name}`} onChange={() => void update(row, { f22Sent: !row.f22Sent })} /></td><td><Checkbox value={Boolean(row.dj1948)} label={`DJ 1948 de ${row.name}`} onChange={() => void update(row, { dj1948: !row.dj1948 })} /></td><td><Checkbox value={Boolean(row.dj1948Sent)} label={`DJ 1948 enviada de ${row.name}`} onChange={() => void update(row, { dj1948Sent: !row.dj1948Sent })} /></td><td><Checkbox value={Boolean(row.dj1949)} label={`DJ 1949 de ${row.name}`} onChange={() => void update(row, { dj1949: !row.dj1949 })} /></td><td><Checkbox value={Boolean(row.provisional)} label={`Provisorio de ${row.name}`} onChange={() => void update(row, { provisional: !row.provisional })} /></td><td className={row.utilityLossAmount !== null && row.utilityLossAmount < 0 ? 'negative' : 'positive'}>{f22Amount(row.utilityLossAmount, row.utilityLossText)}</td><td>{f22Amount(row.dividendsAmount, row.dividendsText)}</td><td><CommitInput className="inline-note" label={`Observación Renta de ${row.name}`} value={row.observation} onCommit={value => void update(row, { observation: value })} /></td><td><CommitInput className="inline-note responsible-note" label={`Responsable Renta de ${row.name}`} value={row.responsibleName} onCommit={value => void update(row, { responsibleName: value })} /></td><td><SaveState state={saving[row.id]} /></td></tr>)}</tbody></table></div><footer className="table-footer"><span>Mostrando {shown.length} de {filtered.length} clientes</span><span className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><b>{page} / {pageCount}</b><button disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Siguiente</button></span></footer></section></>}</div>;
}

function ClientF22Panel({ clientId, taxYear }: { clientId: string; taxYear: number }) {
  const [row, setRow] = useState<F22Row | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); void loadClientF22(clientId, taxYear).then(setRow).finally(() => setLoading(false)); }, [clientId, taxYear]);
  if (loading) return <div className="control-data-state">Cargando Renta/F22…</div>;
  if (!row) return <EmptyPanel title="Renta / F22" text={`Este cliente no tiene un período de Renta AT ${taxYear}.`} />;
  return <div className="profile-grid f22-profile"><section className="control-card"><CardHead title={`Renta · AT ${taxYear}`} subtitle={row.taxRegime || 'Régimen sin informar'} /><div className="profile-status"><Pill value={row.f22Sent ? 'Declarado' : 'Pendiente'}>{row.f22Sent ? 'F22 enviado' : row.saved ? 'Guardado' : 'Pendiente'}</Pill><strong>{row.refundAmount ? clp.format(row.refundAmount) : row.paymentAmount ? clp.format(row.paymentAmount) : '—'}</strong><span>{row.filedDate ? `Presentado ${shortDate(row.filedDate)}` : 'Fecha pendiente'}</span></div></section><section className="control-card"><CardHead title="BCE y declaraciones" subtitle="Estado del proceso anual" /><div className="f22-check-grid"><p><Checkbox value={Boolean(row.bceDate)} label="BCE" /> BCE {row.bceDate ? shortDate(row.bceDate) : 'pendiente'}</p><p><Checkbox value={Boolean(row.f22Ready)} label="RN F22" /> RN / F22</p><p><Checkbox value={row.f22Sent} label="F22 enviado" /> F22 enviado</p><p><Checkbox value={Boolean(row.dj1948Sent)} label="DJ 1948" /> DJ 1948 enviada</p><p><Checkbox value={Boolean(row.provisional)} label="Provisorio" /> Provisorio</p></div></section><section className="control-card span-two"><CardHead title="Resultados y observaciones" subtitle={row.responsibleName} /><div className="f22-result-grid"><div><span>Utilidad / Pérdida</span><strong>{f22Amount(row.utilityLossAmount, row.utilityLossText)}</strong></div><div><span>Retiros / Dividendos</span><strong>{f22Amount(row.dividendsAmount, row.dividendsText)}</strong></div><div><span>Socios</span><strong>{row.partners || '—'}</strong></div></div><p className="f22-profile-note">{row.observation || 'Sin observaciones registradas.'}</p></section></div>;
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

function ClientsIndexV3({ rows, go, reload }: { rows: ClientRow[]; go: (s: Screen, c?: ClientRow) => void; reload: () => Promise<void> }) {
  const [query,setQuery]=useState(''); const [responsible,setResponsible]=useState('Todos'); const [documentFilter,setDocumentFilter]=useState('Todos'); const [f29Filter,setF29Filter]=useState('Todos'); const [billingFilter,setBillingFilter]=useState('Todos'); const [editing,setEditing]=useState<ClientRow|'new'|null>(null); const [scanning,setScanning]=useState<string|null>(null); const [scanResults,setScanResults]=useState<Record<string,{count:number;at:string}>>({}); const [error,setError]=useState('');
  const responsibles=[...new Set(rows.map(row=>row.accountant))].sort();
  const color=(name:string)=>({GABRIELA:'responsible-gabriela','ALE CANDIA':'responsible-ale',PAOLA:'responsible-paola',MARCELA:'responsible-marcela',ANDREA:'responsible-andrea',TANIA:'responsible-tania',LAURA:'responsible-laura',SCARLEN:'responsible-scarlen'}[name.toUpperCase()]??'responsible-default');
  const countFor=(row:ClientRow)=>scanResults[row.id]?.count??row.documents;
  const scanAt=(row:ClientRow)=>scanResults[row.id]?.at??row.lastDriveScanAt;
  const stale=(row:ClientRow)=>!scanAt(row)||Date.now()-new Date(String(scanAt(row))).getTime()>24*60*60*1000;
  const filtered=rows.filter(row=>`${row.rut} ${row.name} ${row.accountingCode??''}`.toLowerCase().includes(query.toLowerCase())&&(responsible==='Todos'||row.accountant===responsible)&&(documentFilter==='Todos'||(documentFilter==='Con documentos'?countFor(row)>0:documentFilter==='Sin revisar'?!scanAt(row):countFor(row)===0))&&(f29Filter==='Todos'||(f29Filter==='Sin estado'?!row.statusCode:row.statusCode===f29Filter))&&(billingFilter==='Todos'||row.billingStatus===billingFilter));
  const clearFilters=()=>{setQuery('');setResponsible('Todos');setDocumentFilter('Todos');setF29Filter('Todos');setBillingFilter('Todos');};
  const openDrive=(event:React.MouseEvent,row:ClientRow)=>{event.stopPropagation();if(row.driveFolderId)window.open(`https://drive.google.com/drive/folders/${row.driveFolderId}`,'_blank','noopener,noreferrer');};
  const refreshDocs=async(event:React.MouseEvent,row:ClientRow)=>{event.stopPropagation();setScanning(row.id);setError('');try{const result=await scanClientDrive(row.id);setScanResults(current=>({...current,[row.id]:{count:result.files_found,at:new Date().toISOString()}}));}catch(reason){setError(reason instanceof Error?reason.message:'No fue posible actualizar Drive.');}finally{setScanning(null);}};
  return <div className="control-content"><PageHeader eyebrow="Base maestra" title="Clientes" description="Cartera activa, cumplimiento y estado de facturación." actions={<button className="button-dark" onClick={()=>setEditing('new')}><Plus size={16}/> Nuevo cliente</button>}/>{error&&<div className="control-data-state is-error"><AlertTriangle size={16}/>{error}</div>}<section className="operations-card"><div className="table-toolbar clients-toolbar"><div className="toolbar-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar RUT, Conta o razón social…"/></div><div className="client-advanced-filters"><select aria-label="Responsable" value={responsible} onChange={event=>setResponsible(event.target.value)}><option>Todos</option>{responsibles.map(name=><option key={name}>{name}</option>)}</select><select aria-label="Estado F29" value={f29Filter} onChange={event=>setF29Filter(event.target.value)}><option>Todos</option><option>Sin estado</option>{Object.entries(F29_STATUS_LABELS).map(([code,label])=><option value={code} key={code}>{label}</option>)}</select><select aria-label="Estado de facturación" value={billingFilter} onChange={event=>setBillingFilter(event.target.value)}><option>Todos</option><option value="not_applicable">Facturación: No aplica</option><option value="pending">Facturación: Pendiente</option><option value="sent">Facturación: Enviada</option><option value="paid">Facturación: Pagada</option><option value="overdue">Facturación: Vencida</option></select><select aria-label="Estado documental" value={documentFilter} onChange={event=>setDocumentFilter(event.target.value)}><option>Todos</option><option>Con documentos</option><option>Sin documentos</option><option>Sin revisar</option></select><button className="filter-button" onClick={clearFilters}>Limpiar</button></div></div><div className="table-scroll"><table className="ops-table clients-table clients-operations-table"><thead><tr><th>RUT</th><th>Conta</th><th>Razón social</th><th>Responsable</th><th>Drive</th><th>F29</th><th>Facturación</th><th>Documentos</th><th>Actualización</th><th/></tr></thead><tbody>{filtered.map(row=><tr key={row.id} onClick={()=>go('client',row)}><td data-label="RUT"><strong>{row.rut}</strong></td><td data-label="Conta"><strong>{row.accountingCode||'—'}</strong></td><td data-label="Cliente"><strong className="truncate-cell" title={row.name}>{row.name}</strong></td><td data-label="Responsable"><span className={`assigned responsible-client ${color(row.accountant)}`}><EmptyAvatar initials={row.initials}/>{row.accountant}</span></td><td data-label="Drive"><button className="drive-button" disabled={!row.driveFolderId} onClick={event=>openDrive(event,row)}><FolderOpen size={15}/>{row.driveFolderId?'Abrir':'Sin carpeta'}</button></td><td data-label="F29"><Pill value={row.statusLabel}>{row.statusLabel}</Pill></td><td data-label="Facturación"><StatusBadge status={row.billingStatus}/></td><td data-label="Documentos"><div className="client-doc-status"><strong>{countFor(row)} docs</strong>{scanAt(row)&&<small>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short'}).format(new Date(String(scanAt(row))))}</small>}{stale(row)&&<button className="quick-refresh-docs" disabled={!row.driveFolderId||scanning===row.id} onClick={event=>void refreshDocs(event,row)}><RefreshCw size={13}/>{scanning===row.id?'Actualizando…':scanAt(row)?'Actualizar':'Revisar'}</button>}</div></td><td data-label="Actualización">{row.updated}</td><td><button className="icon-button compact" aria-label={`Editar ${row.name}`} onClick={event=>{event.stopPropagation();setEditing(row);}}><Settings size={14}/></button></td></tr>)}</tbody></table></div><footer className="table-footer"><span>{filtered.length} clientes</span><span>{rows.filter(row=>row.driveFolderId).length} con carpeta Drive</span></footer></section>{editing&&<ClientEditor client={editing==='new'?undefined:editing} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);await reload();}}/>}</div>;
}

function ClientEditor({ client, onClose, onSaved }: { client?: ClientRow; onClose: () => void; onSaved: () => Promise<void> }) {
  const [rut, setRut] = useState(client?.rut ?? '');
  const [name, setName] = useState(client?.name ?? '');
  const [accountingCode, setAccountingCode] = useState(client?.accountingCode ?? '');
  const [driveFolderId, setDriveFolderId] = useState(client?.driveFolderId ?? '');
  const [taxRegime, setTaxRegime] = useState(client?.taxRegime ?? ''); const [legalType, setLegalType] = useState(client?.legalType ?? ''); const [legalEmail, setLegalEmail] = useState(client?.legalRepresentativeEmail ?? '');
  const [economicActivity, setEconomicActivity] = useState(client?.economicActivity ?? ''); const [address, setAddress] = useState(client?.address ?? ''); const [phone, setPhone] = useState(client?.phone ?? '');
  const [bankName, setBankName] = useState(client?.bankName ?? ''); const [checkingAccount, setCheckingAccount] = useState(client?.checkingAccount ?? ''); const [accountingType, setAccountingType] = useState<ClientRow['accountingType']>(client?.accountingType ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!rut.trim() || !name.trim()) return setError('RUT y razón social son obligatorios.'); setSaving(true); setError(''); try { await saveClient({ rut: rut.trim(), name: name.trim(), accountingCode: accountingCode.trim(), driveFolderId: driveFolderId.trim(), taxRegime: taxRegime.trim(), legalType: legalType.trim(), legalRepresentativeEmail: legalEmail.trim(), economicActivity: economicActivity.trim(), address: address.trim(), phone: phone.trim(), bankName: bankName.trim(), checkingAccount: checkingAccount.trim(), accountingType, isActive: true }, client?.id); await onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar el cliente.'); setSaving(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="control-modal client-editor-modal" onSubmit={submit}><header><div><span>Base maestra</span><h2>{client ? 'Editar cliente' : 'Nuevo cliente'}</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header><label>RUT<input value={rut} onChange={event => setRut(event.target.value)} placeholder="76.123.456-7" /></label><label>Razón social<input value={name} onChange={event => setName(event.target.value)} /></label><label>Código contable<input value={accountingCode} onChange={event => setAccountingCode(event.target.value)} /></label><div className="form-split"><label>Régimen tributario<input value={taxRegime} onChange={event=>setTaxRegime(event.target.value)}/></label><label>Tipo jurídico<input value={legalType} onChange={event=>setLegalType(event.target.value)}/></label></div><label>Email representante legal<input type="email" value={legalEmail} onChange={event=>setLegalEmail(event.target.value)}/></label><label>Actividad económica<input value={economicActivity} onChange={event=>setEconomicActivity(event.target.value)}/></label><div className="form-split"><label>Dirección<input value={address} onChange={event=>setAddress(event.target.value)}/></label><label>Teléfono<input type="tel" value={phone} onChange={event=>setPhone(event.target.value)}/></label></div><div className="form-split"><label>Banco<input value={bankName} onChange={event=>setBankName(event.target.value)}/></label><label>Cuenta corriente<input value={checkingAccount} onChange={event=>setCheckingAccount(event.target.value)}/></label></div><label>Tipo de contabilidad<select value={accountingType} onChange={event=>setAccountingType(event.target.value as ClientRow['accountingType'])}><option value="">Sin informar</option><option value="simplified">Simplificada</option><option value="complete">Completa</option></select></label><label>ID carpeta Google Drive<input value={driveFolderId} onChange={event => setDriveFolderId(event.target.value)} placeholder="ID, no la URL completa" /></label>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="button-ghost" onClick={onClose}>Cancelar</button><button className="button-dark" disabled={saving}><Save size={15} />{saving ? 'Guardando…' : 'Guardar cliente'}</button></footer></form></div>;
}

type ProfileTab = 'Resumen' | 'F29 mensual' | 'Renta / F22' | 'Documentos' | 'Contactos' | 'Observaciones' | 'Actividad';

function ClientProfileV2({ client, year, month, reload }: { client: ClientRow; year: number; month: number; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<ProfileTab>('Resumen');
  const [history, setHistory] = useState<PeriodHistory[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [observations, setObservations] = useState<ClientObservation[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [billingSummary, setBillingSummary] = useState<ClientBillingSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const refresh = async () => { setLoadError(''); try { const [nextHistory, nextDocuments, nextObservations, nextActivity, nextBilling] = await Promise.all([loadClientHistory(client.id), loadClientDocuments(client.id), loadClientObservations(client.id), loadClientActivity(client.id), loadClientBillingSummary(client.id)]); setHistory(nextHistory); setDocuments(nextDocuments); setObservations(nextObservations); setActivity(nextActivity); setBillingSummary(nextBilling); } catch (error) { setLoadError(error instanceof Error ? error.message : 'No fue posible cargar toda la ficha.'); } finally { setLoading(false); } };
  useEffect(() => { setLoading(true); void refresh(); }, [client.id]);
  const openDrive = () => { if (client.driveFolderId) window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank', 'noopener,noreferrer'); };
  return <div className="control-content"><div className="client-profile-head"><div className="client-monogram">{client.name.charAt(0)}</div><div><span>Cliente activo</span><h1>{client.name}</h1><p>{client.rut} · {client.accountant}</p></div><div className="page-actions"><button className="button-ghost" disabled={!client.periodId} title={!client.periodId ? 'No existe un período F29 para este mes' : ''} onClick={() => setEmailOpen(true)}><Mail size={16} /> Preparar F29 Email</button><button className="button-ghost" disabled={!client.driveFolderId} onClick={openDrive}><FolderOpen size={16} />{client.driveFolderId ? 'Abrir Drive' : 'Sin carpeta Drive'}</button><button className="button-dark" onClick={() => setEditing(true)}>Editar cliente</button></div></div><nav className="profile-tabs">{(['Resumen', 'F29 mensual', 'Renta / F22', 'Documentos', 'Contactos', 'Observaciones', 'Actividad'] as ProfileTab[]).map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}{item === 'Documentos' && <em>{documents.filter(document => !document.isFolder).length}</em>}</button>)}</nav>{loadError && <div className="control-data-state is-error"><AlertTriangle size={16} />{loadError}</div>}{loading ? <div className="control-data-state">Cargando ficha del cliente…</div> : tab === 'Resumen' ? <ClientSummaryV2 client={client} history={history} year={year} month={month} observations={observations} billing={billingSummary} /> : tab === 'F29 mensual' ? <HistoryPanel history={withUpcoming(history)} /> : tab === 'Renta / F22' ? <ClientF22Panel clientId={client.id} taxYear={2026} /> : tab === 'Documentos' ? <DocumentsPanelRecursive client={client} documents={documents} refresh={refresh} /> : tab === 'Contactos' ? <ClientContactsPanel clientId={client.id} /> : tab === 'Observaciones' ? <ObservationsPanel client={client} observations={observations} refresh={refresh} /> : <ActivityPanelV2 client={client} activity={activity} />}{editing && <ClientEditor client={client} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await reload(); }} />}{emailOpen && <EmailComposer row={client} onClose={() => setEmailOpen(false)} onSent={reload} />}</div>;
}

type TimelinePeriod = PeriodHistory & { upcoming?: boolean };
function withUpcoming(history: PeriodHistory[]): TimelinePeriod[] {
  const result: TimelinePeriod[] = [...history]; const now = new Date(); const existing = new Set(history.map(item=>`${item.year}-${item.month}`));
  for(let offset=1;offset<=2;offset++){const date=new Date(now.getFullYear(),now.getMonth()+offset,1);const year=date.getFullYear();const month=date.getMonth()+1;if(!existing.has(`${year}-${month}`))result.push({id:`future-${year}-${month}`,year,month,amount:null,filed_date:null,status_code:null,status_label:'Próximo',upcoming:true});}
  return result.sort((a,b)=>b.year-a.year||b.month-a.month);
}

function ClientBillingCard({ clientId, summary }: { clientId: string; summary: ClientBillingSummary | null }) {
  const [plans,setPlans]=useState<{id:string;name:string}[]>([]); const [serviceId,setServiceId]=useState(''); const [subscribed,setSubscribed]=useState(summary?.subscribed??false); const [saving,setSaving]=useState(false); const [message,setMessage]=useState('');
  useEffect(()=>{setSubscribed(summary?.subscribed??false);void loadServicePlans().then(value=>{setPlans(value);setServiceId(value.find(plan=>plan.name===summary?.serviceName)?.id??value[0]?.id??'');}).catch(()=>setPlans([]));},[summary?.serviceName,summary?.subscribed]);
  const save=async()=>{if(!serviceId)return;setSaving(true);setMessage('');try{await updateClientPlan(clientId,summary?.serviceId??null,serviceId,subscribed);setMessage('Plan guardado y auditado.');}catch(error){setMessage(error instanceof Error?error.message:'No fue posible guardar el plan.');}finally{setSaving(false);}};
  const money=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
  return <section className="control-card billing-summary-card"><CardHead title="Facturación" subtitle={summary?.serviceName??'Sin plan asociado'}/><div className="billing-summary-grid"><span><small>Estado</small><StatusBadge status={summary?.status??'not_applicable'}/></span><span><small>Deuda actual</small><strong>{money.format(summary?.debt??0)}</strong></span><span><small>Último pago</small><strong>{summary?.lastPaymentAt?shortDate(summary.lastPaymentAt):'—'}</strong><small>{summary?.lastPaymentAmount?money.format(summary.lastPaymentAmount):''}</small></span><span><small>Último recordatorio</small><strong>{summary?.lastReminderAt?shortDate(summary.lastReminderAt):'—'}</strong></span><span><small>Enlace de pago</small><strong>{summary?.paymentLinkActive?'Activo':'Sin enlace'}</strong></span></div>{plans.length>0&&<div className="client-plan-editor"><select aria-label="Plan o servicio" value={serviceId} onChange={event=>setServiceId(event.target.value)}>{plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name}</option>)}</select><label><input type="checkbox" checked={subscribed} onChange={event=>setSubscribed(event.target.checked)}/> Suscrito</label><button disabled={saving} onClick={()=>void save()}>{saving?'Guardando…':'Guardar plan'}</button></div>}{message&&<small className="plan-message">{message}</small>}<a className="billing-summary-link" href="/billing">Ver cobros relacionados →</a></section>;
}

function ClientSummaryV2({ client, history, year, month, observations, billing }: { client: ClientRow; history: PeriodHistory[]; year: number; month: number; observations: ClientObservation[]; billing: ClientBillingSummary | null }) {
  const money=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
  return <div className="profile-grid"><section className="control-card"><CardHead title={`F29 · ${MONTH_NAMES[month - 1]} ${year}`} subtitle="Período actual" /><div className="profile-status"><Pill value={client.statusLabel}>{client.statusLabel}</Pill><strong>{client.amount === null ? '—' : money.format(client.amount)}</strong><span>{client.filedDate ? `Presentado ${shortDate(client.filedDate)}` : 'Fecha pendiente'}</span></div></section><ClientBillingCard clientId={client.id} summary={billing}/><section className="control-card span-two"><CardHead title="Historial F29" subtitle="Períodos registrados y próximos" /><HistoryGrid history={withUpcoming(history).slice(0, 8)} /></section><section className="control-card span-two admin-metadata"><CardHead title="Información administrativa" subtitle="Datos editables desde Editar cliente" /><dl><div><dt>Régimen tributario</dt><dd>{client.taxRegime||'—'}</dd></div><div><dt>Tipo jurídico</dt><dd>{client.legalType||'—'}</dd></div><div><dt>Representante legal</dt><dd>{client.legalRepresentativeEmail||'—'}</dd></div><div><dt>Actividad económica</dt><dd>{client.economicActivity||'—'}</dd></div><div><dt>Dirección / teléfono</dt><dd>{client.address||'—'} · {client.phone||'—'}</dd></div><div><dt>Banco / cuenta</dt><dd>{client.bankName||'—'} · {client.checkingAccount||'—'}</dd></div><div><dt>Contabilidad</dt><dd>{client.accountingType==='complete'?'Completa':client.accountingType==='simplified'?'Simplificada':'—'}</dd></div><div><dt>Código Conta</dt><dd>{client.accountingCode||'—'}</dd></div></dl></section><section className="control-card span-two"><CardHead title="Observaciones" subtitle="Notas operativas del equipo" /><div className="observation-box"><EmptyAvatar initials={client.initials} /><div><strong>{observations[0]?.author ?? client.accountant}</strong><p>{observations[0]?.body || client.observation || 'Cliente al día. Sin observaciones pendientes.'}</p><small>{observations[0] ? dateTime(observations[0].createdAt) : `Actualizado ${client.updated.toLowerCase()}`}</small></div></div></section></div>;
}

function HistoryGrid({ history }: { history: TimelinePeriod[] }) { const names = MONTH_NAMES.map(name => name.slice(0, 3)); return <>{history.length ? <div className="history-row">{history.map(period => <div className={period.upcoming?'is-upcoming':''} key={period.id}><span>{names[period.month - 1]} {String(period.year).slice(-2)}</span><i className={period.upcoming?'upcoming':period.status_code === 'B' || period.status_code === 'H' ? 'blocked' : 'done'}>{period.upcoming?'·':period.status_code ?? '—'}</i><small>{period.status_label ?? 'Sin estado'}</small></div>)}</div> : <p className="empty-history">Sin períodos F29 registrados.</p>}</>; }

function HistoryPanel({ history }: { history: TimelinePeriod[] }) { return <section className="operations-card"><div className="documents-head"><div><h2>Historial F29</h2><p>Períodos registrados y próximos meses informativos.</p></div></div><div className="table-scroll"><table className="ops-table responsive-table"><thead><tr><th>Período</th><th>Estado</th><th>Monto</th><th>Fecha</th></tr></thead><tbody>{history.map(item => <tr className={item.upcoming?'future-period-row':''} key={item.id}><td data-label="Período"><strong>{MONTH_NAMES[item.month - 1]} {item.year}</strong></td><td data-label="Estado">{item.upcoming?<span className="future-badge">Próximo</span>:<Pill value={item.status_label ?? 'Sin estado'}>{item.status_label ?? 'Sin estado'}</Pill>}</td><td data-label="Monto">{item.amount === null ? '—' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(item.amount))}</td><td data-label="Fecha">{shortDate(item.filed_date)}</td></tr>)}</tbody></table></div></section>; }

function EmptyPanel({ title, text }: { title: string; text: string }) { return <section className="control-card empty-panel"><FileSpreadsheet size={28} /><h2>{title}</h2><p>{text}</p></section>; }

const DOCUMENT_LABELS: Record<DocumentKind, string> = { f29: 'F29', rcv: 'RCV', bce: 'BCE', f22: 'F22', dj_1948: 'DJ 1948', dj_1949: 'DJ 1949', excel: 'Excel', pdf: 'PDF', certificate: 'Certificado', receipt: 'Comprobante', contract: 'Contrato', other: 'Otro' };

function DocumentsPanel({ client, documents, refresh }: { client: ClientRow; documents: ClientDocument[]; refresh: () => Promise<void> }) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [needsDriveAuthorization, setNeedsDriveAuthorization] = useState(false);
  const scan = async () => { setScanning(true); setMessage(''); setNeedsDriveAuthorization(false); try { const result = await scanClientDrive(client.id); setMessage(`${result.files_found} archivos encontrados · ${result.new_files} nuevos · ${result.updated_files} actualizados`); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error al escanear Drive.'); setNeedsDriveAuthorization(error instanceof DriveAuthorizationError); } finally { setScanning(false); } };
  const classify = async (document: ClientDocument, type: DocumentKind) => { setMessage('Guardando clasificación…'); try { await classifyDocument(document.id, type); await refresh(); setMessage('Clasificación guardada.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible clasificar el documento.'); } };
  return <section className="operations-card documents-panel"><div className="documents-head"><div><h2>Documentos en Google Drive</h2><p>{client.driveFolderId ? 'Archivos sincronizados con el acceso Google del empleado.' : 'Agrega un ID de carpeta Drive para habilitar la sincronización.'}</p>{message && <small className={`operation-message ${needsDriveAuthorization ? 'is-warning' : ''}`}>{message}</small>}</div>{needsDriveAuthorization ? <button className="button-dark" onClick={() => void connectGoogleDrive()}><ShieldCheck size={16} /> Autorizar Google Drive</button> : <button className="button-dark" disabled={scanning || !client.driveFolderId} onClick={() => void scan()}><Cloud size={16} />{scanning ? 'Escaneando…' : 'Escanear carpeta'}</button>}</div><div className="table-scroll"><table className="ops-table"><thead><tr><th>Archivo</th><th>Tipo</th><th>Modificado</th><th>Estado</th><th /></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td><span className="file-name"><FileSpreadsheet size={18} /><span><strong>{doc.name}</strong><small>{doc.mimeType ?? 'Tipo desconocido'}</small></span></span></td><td><select className="inline-select" value={doc.type} onChange={event => void classify(doc, event.target.value as DocumentKind)}>{(Object.keys(DOCUMENT_LABELS) as DocumentKind[]).map(type => <option key={type} value={type}>{DOCUMENT_LABELS[type]}</option>)}</select></td><td>{doc.modifiedAt ? dateTime(doc.modifiedAt) : '—'}</td><td><Pill value={doc.processingStatus === 'classified' ? 'Listo' : 'Pendiente'}>{doc.processingStatus === 'classified' ? 'Clasificado' : 'Sin clasificar'}</Pill></td><td>{doc.driveUrl && <a className="drive-button" href={doc.driveUrl} target="_blank" rel="noreferrer">Abrir en Drive <ExternalLink size={13} /></a>}</td></tr>)}</tbody></table>{!documents.length && <div className="empty-table">Todavía no hay documentos sincronizados.</div>}</div></section>;
}

function DocumentsPanelRecursive({ client, documents, refresh }: { client: ClientRow; documents: ClientDocument[]; refresh: () => Promise<void> }) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [needsDriveAuthorization, setNeedsDriveAuthorization] = useState(false);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<'all' | 'f29' | 'f22' | 'other'>('all');
  const [showFolders, setShowFolders] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const filtered = useMemo(() => documents.filter(document =>
    (showFolders || !document.isFolder) &&
    (moduleFilter === 'all' || document.module === moduleFilter) &&
    `${document.name} ${document.drivePath}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [documents, moduleFilter, query, showFolders]);
  useEffect(() => setPage(1), [moduleFilter, query, showFolders]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const fileCount = documents.filter(document => !document.isFolder).length;
  const folderCount = documents.length - fileCount;
  const scan = async () => {
    setScanning(true); setMessage(''); setNeedsDriveAuthorization(false);
    try {
      const result = await scanClientDrive(client.id);
      setMessage(`${result.files_found} archivos · ${result.folders_found} carpetas · ${result.new_files} nuevos · profundidad ${result.max_depth}${result.truncated ? ' · escaneo limitado' : ''}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al escanear Drive.');
      setNeedsDriveAuthorization(error instanceof DriveAuthorizationError);
    } finally { setScanning(false); }
  };
  const classify = async (document: ClientDocument, type: DocumentKind) => {
    setMessage('Guardando clasificación…');
    try { await classifyDocument(document.id, type); await refresh(); setMessage('Clasificación guardada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible clasificar el documento.'); }
  };
  const moduleLabel = (module: ClientDocument['module']) => module === 'f29' ? 'F29 · Impuestos' : module === 'f22' ? 'F22 · Renta' : 'General';
  return <section className="operations-card documents-panel recursive-documents"><div className="documents-head"><div><h2>Documentos en Google Drive</h2><p>{client.driveFolderId ? `${fileCount} archivos y ${folderCount} carpetas sincronizados con su ruta completa.` : 'Agrega un ID de carpeta Drive para habilitar la sincronización.'}</p>{message && <small className={`operation-message ${needsDriveAuthorization ? 'is-warning' : ''}`}>{message}</small>}</div>{needsDriveAuthorization ? <button className="button-dark" onClick={() => void connectGoogleDrive()}><ShieldCheck size={16} /> Autorizar Google Drive</button> : <button className="button-dark" disabled={scanning || !client.driveFolderId} onClick={() => void scan()}><Cloud size={16} />{scanning ? 'Escaneando árbol…' : 'Escanear todo Drive'}</button>}</div><div className="table-toolbar document-toolbar"><div className="toolbar-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar archivo o ruta…" /></div><select aria-label="Área documental" value={moduleFilter} onChange={event => setModuleFilter(event.target.value as typeof moduleFilter)}><option value="all">Todas las áreas</option><option value="f29">F29 · Impuestos</option><option value="f22">F22 · Renta</option><option value="other">Otras carpetas</option></select><button className={`filter-button ${showFolders ? 'active' : ''}`} onClick={() => setShowFolders(value => !value)}><FolderOpen size={14} />{showFolders ? 'Ocultar carpetas' : 'Mostrar carpetas'}</button></div><div className="table-scroll"><table className="ops-table documents-tree-table"><thead><tr><th>Archivo</th><th>Área</th><th>Ruta en Drive</th><th>Tipo</th><th>Modificado</th><th>Estado</th><th /></tr></thead><tbody>{shown.map(doc => <tr key={doc.id}><td><span className="file-name">{doc.isFolder ? <FolderOpen size={18} /> : <FileSpreadsheet size={18} />}<span><strong>{doc.name}</strong><small>{doc.isFolder ? 'Carpeta' : doc.mimeType ?? 'Tipo desconocido'}</small></span></span></td><td><Pill value={doc.module === 'f29' ? 'Informada' : doc.module === 'f22' ? 'Declarado' : 'Sin pago'}>{moduleLabel(doc.module)}</Pill></td><td><span className="document-path" title={doc.drivePath}>{doc.drivePath}</span></td><td>{doc.isFolder ? <span className="folder-label">Carpeta</span> : <select className="inline-select" value={doc.type} onChange={event => void classify(doc, event.target.value as DocumentKind)}>{(Object.keys(DOCUMENT_LABELS) as DocumentKind[]).map(type => <option key={type} value={type}>{DOCUMENT_LABELS[type]}</option>)}</select>}</td><td>{doc.modifiedAt ? dateTime(doc.modifiedAt) : '—'}</td><td>{doc.isFolder ? <Pill value="Sin pago">Navegación</Pill> : <Pill value={doc.processingStatus === 'classified' ? 'Listo' : 'Pendiente'}>{doc.processingStatus === 'classified' ? 'Clasificado' : 'Sin clasificar'}</Pill>}</td><td>{doc.driveUrl && <a className="drive-button" href={doc.driveUrl} target="_blank" rel="noreferrer">Abrir <ExternalLink size={13} /></a>}</td></tr>)}</tbody></table>{!filtered.length && <div className="empty-table">No hay archivos para este filtro. Ejecuta el escaneo recursivo para descubrir el árbol completo.</div>}</div><footer className="table-footer"><span>Mostrando {shown.length} de {filtered.length} elementos</span><span className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><b>{page} / {pageCount}</b><button disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Siguiente</button></span></footer></section>;
}

function ObservationsPanel({ client, observations, refresh }: { client: ClientRow; observations: ClientObservation[]; refresh: () => Promise<void> }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!body.trim()) return; setSaving(true); try { await addClientObservation(client.id, body.trim()); setBody(''); await refresh(); } finally { setSaving(false); } };
  return <section className="control-card notes-panel"><CardHead title="Observaciones" subtitle="Notas internas auditables" /><form className="observation-form" onSubmit={submit}><textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Agregar una observación para el equipo…" /><button className="button-dark" disabled={saving || !body.trim()}><Plus size={15} />{saving ? 'Guardando…' : 'Agregar observación'}</button></form><ul className="notes-list">{observations.map(note => <li key={note.id}><EmptyAvatar initials={note.author.split(/\s+/).map(part => part[0]).join('').slice(0, 2)} /><div><strong>{note.author}</strong><p>{note.body}</p><small>{dateTime(note.createdAt)}</small></div></li>)}</ul>{!observations.length && <div className="empty-table">No hay observaciones registradas.</div>}</section>;
}

const ACTIVITY_LABELS: Record<string, string> = { f29_period_updated: 'Período F29 actualizado', drive_scan: 'Carpeta Drive escaneada', document_classified: 'Documento clasificado', observation_added: 'Observación agregada', client_updated: 'Ficha del cliente actualizada', client_created: 'Cliente creado' };
function ActivityPanelV2({ client, activity }: { client: ClientRow; activity: ActivityEntry[] }) { return <section className="control-card activity-panel"><CardHead title="Historial de actividad" subtitle={`Trazabilidad completa de ${client.name}`} /><ul className="timeline">{activity.map(item => <li key={item.id}><span><Check size={14} /></span><div><strong>{ACTIVITY_LABELS[item.action] ?? item.action}</strong><p>{item.actor} · {dateTime(item.createdAt)}</p></div></li>)}</ul>{!activity.length && <div className="empty-table">No hay actividad registrada para este cliente.</div>}</section>; }
