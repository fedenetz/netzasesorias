import { useEffect, useMemo, useState, type ClipboardEvent } from 'react';
import { AlertTriangle, Check, Clock3, ExternalLink, FileSpreadsheet, Image, Mail, Paperclip, Send, X } from 'lucide-react';
import { loadClientDocuments } from './client-api';
import { driveAttachment, loadClientContacts, loadEmailTemplate, loadLastEmailRecipients, loadStoredAttachments, sendF29Email, sendF29PaymentReminder, uploadEmailAttachment } from './communication-api';
import type { ClientDocument, ClientRow, EmailAttachment } from './types';

const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : 'Pendiente';
const interpolate = (value: string, vars: Record<string,string>) => value.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => vars[key] ?? '—');
const safeHtml = (value: string) => value.replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
const addresses = (value: string) => [...new Set(value.split(/[;,]/).map(item => item.trim().toLowerCase()).filter(Boolean))];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\\/g, '/');

function belongsToPeriod(document: ClientDocument, row: ClientRow) {
  const path = normalize(document.drivePath);
  const mm = String(row.month).padStart(2, '0');
  const month = normalize(months[row.month - 1]);
  return path.includes(`/f29/${row.year}/${mm}`) || path.includes(`/f29/${row.year}/${row.month}`) || path.includes(`/impuestos/${row.year}/${mm}`) || (path.includes(`/impuestos/${row.year}/`) && path.includes(month));
}

function suggestedDocument(document: ClientDocument, row: ClientRow) {
  if (!belongsToPeriod(document, row)) return false;
  const name = normalize(document.name);
  const spreadsheet = /\.(xls|xlsx|xlsm)$/.test(name) || document.mimeType === 'application/vnd.google-apps.spreadsheet';
  return (name.includes('iva') && name.includes('f29')) || spreadsheet;
}

export function F29MailComposer({ row, mode = 'summary', onClose, onSent }: { row: ClientRow; mode?: 'summary' | 'tax-reminder'; onClose: () => void; onSent: () => Promise<void> }) {
  const [to, setTo] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [lastRecipients, setLastRecipients] = useState<string[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]); const [stored, setStored] = useState<EmailAttachment[]>([]); const [selected, setSelected] = useState<EmailAttachment[]>([]);
  const [stage, setStage] = useState<'edit'|'preview'|'confirm'>('edit'); const [loading, setLoading] = useState(true); const [uploading, setUploading] = useState(false); const [sending, setSending] = useState(false); const [error, setError] = useState('');
  const requiredCc = [...new Set([row.accountantEmail.trim().toLowerCase(), 'richard@ainahue.cl'].filter(Boolean))];
  const isReminder = mode === 'tax-reminder';
  const variables = useMemo<Record<string,string>>(() => ({ client_name: row.name, month_name: months[row.month - 1], year: String(row.year), amount: money.format(row.amount ?? 0), filed_date: displayDate(row.filedDate || new Date().toISOString().slice(0,10)), payment_due_date: displayDate(row.taxPaymentDueDate), payment_status: row.statusLabel, due_day: row.dueDay ? String(row.dueDay) : '—', firm_name: 'Netz Asesorías' }), [row]);

  useEffect(() => { void (async () => { try {
    const [contacts, template, last, docs, uploads] = await Promise.all([loadClientContacts(row.id), loadEmailTemplate(isReminder ? 'f29_payment_reminder' : 'f29_monthly_summary'), loadLastEmailRecipients(row.id, isReminder ? 'f29_payment_reminder' : 'f29_summary'), loadClientDocuments(row.id), row.periodId ? loadStoredAttachments(row.periodId) : Promise.resolve([])]);
    const contactEmails = contacts.filter(item => item.isActive && item.isBilling).map(item => item.email);
    setLastRecipients(last); setTo((contactEmails.length ? contactEmails : last).join(', ')); setSubject(template.subject); setBody(template.bodyHtml); setDocuments(docs.filter(item => !item.isFolder && item.module === 'f29')); setStored(uploads);
  } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible preparar el correo.'); } finally { setLoading(false); } })(); }, [row.id, row.periodId, isReminder]);

  const exactFolder = documents.filter(document => belongsToPeriod(document, row));
  const periodDocuments = exactFolder.length ? exactFolder : documents;
  const suggestedIds = new Set(periodDocuments.filter(document => suggestedDocument(document,row)).map(document => document.id));
  const toggle = (attachment: EmailAttachment) => setSelected(current => current.some(item => item.id && item.id === attachment.id || item.documentId && item.documentId === attachment.documentId) ? current.filter(item => item.id !== attachment.id || item.documentId !== attachment.documentId) : [...current, attachment]);
  const upload = async (file?: File) => { if (!file || !row.periodId) return; setUploading(true); setError(''); try { const result = await uploadEmailAttachment(row.id,row.periodId,file); setStored(current => [result,...current]); setSelected(current => [...current,result]); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible subir el archivo.'); } finally { setUploading(false); } };
  const pasteImage = (event: ClipboardEvent<HTMLDivElement>) => { const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/')); if (!image) return; event.preventDefault(); const extension = image.type === 'image/jpeg' ? 'jpg' : 'png'; void upload(new File([image], `comprobante-sii-${row.year}-${String(row.month).padStart(2,'0')}-${Date.now()}.${extension}`, { type: image.type })); };
  const submit = async (schedule = false) => { if (!row.periodId) return; if (!requiredCc.includes('richard@ainahue.cl') || !row.accountantEmail) return setError('El responsable debe tener un email configurado.'); setSending(true); setError(''); try { if (isReminder) await sendF29PaymentReminder(row.periodId,addresses(to),requiredCc,subject,body); else await sendF29Email(row.periodId,addresses(to),requiredCc,subject,body,selected,schedule); await onSent(); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible enviar el correo.'); setStage('edit'); } finally { setSending(false); } };
  const previewSubject = interpolate(subject,variables); const previewBody = safeHtml(interpolate(body,variables));

  return <div className="modal-backdrop"><section className="control-modal f29-mail-composer"><header><div><span>{isReminder ? 'Pago mensual F29' : 'Comunicación F29'}</span><h2>{isReminder ? 'Recordatorio pago F29' : 'Preparar mail F29'}</h2></div><button onClick={onClose}><X size={18}/></button></header>{loading ? <div className="control-data-state">Preparando destinatarios y carpeta del período…</div> : <>
    <div className="composer-steps"><b className={stage==='edit'?'active':''}>1. Preparar</b><b className={stage==='preview'?'active':''}>2. Revisar</b><b className={stage==='confirm'?'active':''}>3. Confirmar</b></div>
    {stage==='edit' ? <div className="f29-mail-grid"><label>Para<input value={to} onChange={event=>setTo(event.target.value)} placeholder="cliente@empresa.cl" /></label>{lastRecipients.length>0 && <div className="recipient-suggestions"><small>Último destinatario utilizado</small>{lastRecipients.map(email=><button key={email} onClick={()=>setTo(email)}>{email}</button>)}</div>}<label>CC obligatorio<input value={requiredCc.join(', ')} readOnly /></label>{!row.accountantEmail && <p className="form-error">El responsable {row.accountant} no tiene email asociado en Perfiles.</p>}<label>Asunto<input value={subject} onChange={event=>setSubject(event.target.value)} /></label><label>Cuerpo HTML<textarea value={body} onChange={event=>setBody(event.target.value)} /></label>
      {!isReminder && <section className="period-files"><div><strong><Paperclip size={14}/> Archivos de /f29/{row.year}/{String(row.month).padStart(2,'0')}</strong><small>{exactFolder.length ? `${exactFolder.length} archivo(s) encontrados en la carpeta del período.` : 'No se encontró la ruta exacta; se muestran los archivos F29 disponibles para control.'}</small></div><div className="period-file-list">{stored.map(item=><button key={item.id} className={selected.some(value=>value.id===item.id)?'selected':''} onClick={()=>toggle(item)}><Image size={14}/><span>{item.fileName}<small>Subido</small></span>{selected.some(value=>value.id===item.id)&&<Check size={13}/>}</button>)}{periodDocuments.map(document=>{const attachment=driveAttachment(document);const active=selected.some(value=>value.documentId===document.id);const suggested=suggestedIds.has(document.id);return <button key={document.id} className={`${active?'selected ':''}${suggested?'suggested':''}`} onClick={()=>toggle(attachment)}><FileSpreadsheet size={14}/><span>{document.name}<small>{suggested?'Sugerido · ':''}{document.drivePath}</small></span>{active?<Check size={13}/>:<ExternalLink size={12}/>}</button>})}</div>{!periodDocuments.length&&<p className="empty-folder">No hay archivos indexados. Recarga Drive desde la ficha del cliente.</p>}<div className="attachment-actions"><label className="upload-button"><input type="file" accept=".pdf,.xls,.xlsx,.xlsm,image/png,image/jpeg" disabled={uploading} onChange={event=>void upload(event.target.files?.[0])}/>{uploading?'Subiendo…':'Subir adjunto'}</label><div className="paste-screenshot" tabIndex={0} onPaste={pasteImage}><Image size={15}/> Haz clic aquí y pega una captura de SII con Ctrl+V</div></div></section>}
    </div> : <div className="email-preview"><strong>{previewSubject}</strong><p>Para: {to||'—'} · CC: {requiredCc.join(', ')}</p>{row.statusCode!=='A'&&<div className="status-review-warning"><AlertTriangle size={16}/><span><b>Estado actual: {row.statusLabel}</b> — revise antes de enviar; se esperaba Cargada.</span></div>}<article dangerouslySetInnerHTML={{__html:previewBody}}/>{selected.length>0&&<small>{selected.length} archivo(s) adjunto(s)</small>}{stage==='confirm'&&<div className="confirm-warning"><AlertTriangle size={16}/>Confirma destinatarios, estado y adjuntos antes de continuar.</div>}</div>}
    {error&&<p className="form-error">{error}</p>}<footer><button className="button-ghost" onClick={stage==='edit'?onClose:()=>setStage(stage==='confirm'?'preview':'edit')}>{stage==='edit'?'Cancelar':'Volver'}</button>{stage==='edit'&&<button className="button-dark" disabled={!to.trim()||!subject.trim()||!body.trim()||!row.accountantEmail} onClick={()=>setStage('preview')}>Vista previa</button>}{stage==='preview'&&<button className="button-dark" onClick={()=>setStage('confirm')}>Continuar</button>}{stage==='confirm'&&<><button className="button-dark" disabled={sending} onClick={()=>void submit(false)}><Send size={14}/>{sending?'Procesando…':'Enviar ahora'}</button>{!isReminder&&<button className="button-schedule" disabled={sending} onClick={()=>void submit(true)}><Clock3 size={14}/>Programar próximo día hábil · 08:00</button>}</>}</footer>
  </>}</section></div>;
}
