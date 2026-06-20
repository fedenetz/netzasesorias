import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CircleHelp, Play, X } from 'lucide-react';
import { helpContent, onboardingItems, type HelpPageId, type HelpRole, type HelpTourStep } from './helpContent';

const ONBOARDING_KEY = 'netz-control-onboarding-v1';
const TOUR_KEY = 'netz-control-tours-v1';

type ChecklistState = { dismissed: boolean; completed: number[] };

function readChecklist(): ChecklistState {
  try { return { dismissed: false, completed: [], ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') }; }
  catch { return { dismissed: false, completed: [] }; }
}

function HelpSection({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <details className="help-section" open={open}><summary>{title}<ChevronDown size={15}/></summary><div>{children}</div></details>;
}

export function ContextualTooltip({ label, children }: { label: string; children?: React.ReactNode }) {
  return <span className="context-help"><button type="button" aria-label={label} aria-describedby={undefined}><CircleHelp size={13}/></button><span role="tooltip">{children ?? label}</span></span>;
}

function QuickTour({ steps, onClose, page }: { steps: HelpTourStep[]; onClose: () => void; page: HelpPageId }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];
  useLayoutEffect(() => {
    const target = document.querySelector(step.target) as HTMLElement | null;
    if (!target) { if (index < steps.length - 1) setIndex(value => value + 1); else onClose(); return; }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const update = () => setRect(target.getBoundingClientRect());
    const timer = window.setTimeout(update, 250); update();
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [index, onClose, step.target]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  if (!rect) return null;
  const finish = () => { try { const seen = JSON.parse(localStorage.getItem(TOUR_KEY) ?? '[]') as string[]; localStorage.setItem(TOUR_KEY, JSON.stringify([...new Set([...seen, page])])); } catch { /* preference only */ } onClose(); };
  const top = Math.min(window.innerHeight - 190, Math.max(16, rect.bottom + 14));
  const left = Math.min(window.innerWidth - 330, Math.max(16, rect.left));
  return <div className="quick-tour" role="dialog" aria-modal="true" aria-label="Tour rápido"><button className="tour-scrim" aria-label="Cerrar tour" onClick={finish}/><div className="tour-highlight" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}/><section className="tour-card" style={{ top, left }}><header><span>Paso {index + 1} de {steps.length}</span><button aria-label="Cerrar tour" onClick={finish}><X size={16}/></button></header><h3>{step.title}</h3><p>{step.description}</p><footer>{index > 0 ? <button onClick={() => setIndex(value => value - 1)}>Anterior</button> : <span/>}<button className="tour-next" onClick={() => index === steps.length - 1 ? finish() : setIndex(value => value + 1)}>{index === steps.length - 1 ? 'Terminar' : 'Siguiente'}</button></footer></section></div>;
}

export function HelpSystem({ page, role, open, onOpen, onClose }: { page: HelpPageId; role: HelpRole; open: boolean; onOpen: () => void; onClose: () => void }) {
  const entry = helpContent[page];
  const [checklist, setChecklist] = useState<ChecklistState>(readChecklist);
  const [tourOpen, setTourOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const updateChecklist = (next: ChecklistState) => { setChecklist(next); localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)); };
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', key); };
  }, [onClose, open]);
  const startTour = () => { onClose(); window.setTimeout(() => setTourOpen(true), 120); };
  const overlays = <>
    {open && <div className="help-layer"><button className="help-backdrop" aria-label="Cerrar ayuda" onClick={onClose}/><aside className="help-drawer" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><div><span>Ayuda contextual</span><h2 id="help-title">{entry.title}</h2></div><button ref={closeRef} aria-label="Cerrar ayuda" onClick={onClose}><X size={18}/></button></header><div className="help-scroll"><section className="help-intro"><span>Qué es esta pantalla</span><p>{entry.summary}</p></section>
      <HelpSection title="Flujo recomendado" open><ol>{entry.workflow.map(item => <li key={item}>{item}</li>)}</ol></HelpSection>
      <HelpSection title="Estados y alertas"><dl className="help-statuses">{entry.statuses.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.description}</dd></div>)}</dl></HelpSection>
      <HelpSection title="Acciones principales"><ul>{entry.actions.map(item => <li key={item}>{item}</li>)}</ul></HelpSection>
      <HelpSection title="Errores comunes"><ul>{entry.errors.map(item => <li key={item}>{item}</li>)}</ul></HelpSection>
      <HelpSection title="Preguntas frecuentes">{entry.faq.map(item => <div className="help-faq" key={item.question}><strong>{item.question}</strong><p>{item.answer}</p></div>)}</HelpSection>
      {entry.roleNotes?.[role] && <section className="help-role-note"><strong>{role === 'viewer' ? 'Solo lectura' : role === 'admin' ? 'Nota para administración' : 'Nota operativa'}</strong><p>{entry.roleNotes[role]}</p></section>}
      {!checklist.dismissed && role !== 'viewer' && <section className="onboarding-checklist"><header><div><span>Primeros pasos</span><strong>{checklist.completed.length} de {onboardingItems.length}</strong></div><p>Una guía local para conocer el flujo diario.</p></header>{onboardingItems.map((item, index) => <label key={item}><input type="checkbox" checked={checklist.completed.includes(index)} onChange={() => updateChecklist({ ...checklist, completed: checklist.completed.includes(index) ? checklist.completed.filter(value => value !== index) : [...checklist.completed, index] })}/><span><Check size={12}/></span>{item}</label>)}<button className="dismiss-onboarding" onClick={() => updateChecklist({ ...checklist, dismissed: true })}>No volver a mostrar</button></section>}
    </div>{entry.tour?.length ? <footer className="help-footer"><button onClick={startTour}><Play size={15}/>Iniciar tour rápido</button><small>{entry.tour.length} pasos · se inicia manualmente</small></footer> : null}</aside></div>}
    {tourOpen && entry.tour && <QuickTour page={page} steps={entry.tour.slice(0, 5)} onClose={() => setTourOpen(false)}/>} 
  </>;
  return <><button className="icon-button help-trigger" aria-label="Abrir ayuda de esta pantalla" title="Ayuda" onClick={onOpen}><CircleHelp size={18}/></button>{createPortal(overlays, document.body)}</>;
}
