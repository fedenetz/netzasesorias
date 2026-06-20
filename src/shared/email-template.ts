export type EmailSummaryItem = { label: string; value: string };
export type EmailProof = { name: string; src: string };

export interface NetzEmailTemplateInput {
  title: string;
  eyebrow: string;
  clientName: string;
  periodOrConcept: string;
  bodyHtml: string;
  summary: EmailSummaryItem[];
  attachments?: Array<{ name: string; detail: string }>;
  proofs?: EmailProof[];
  responsibleName?: string;
  replyTo?: string;
  logoUrl?: string;
  paymentLink?: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);

export function renderNetzEmail(input: NetzEmailTemplateInput) {
  const logo = input.logoUrl?.startsWith('https://')
    ? `<img src="${escapeHtml(input.logoUrl)}" width="150" alt="Netz Asesorías" style="display:block;max-width:150px;height:auto;border:0">`
    : '<div style="font-size:20px;line-height:26px;font-weight:700;letter-spacing:-.2px;color:#ffffff">Netz Asesorías</div>';
  const rows = input.summary.map(item => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e4e8eb;color:#53606b;font-size:14px;line-height:20px">${escapeHtml(item.label)}</td><td style="padding:10px 12px;border-bottom:1px solid #e4e8eb;color:#182633;font-size:14px;line-height:20px;font-weight:700;text-align:right">${escapeHtml(item.value)}</td></tr>`).join('');
  const files = input.attachments?.length ? `<div style="margin-top:24px"><h2 style="margin:0 0 10px;color:#182633;font-size:16px;line-height:23px">Archivos y respaldos</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #dfe4e7;border-radius:6px">${input.attachments.map(file => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e4e8eb;color:#182633;font-size:14px;line-height:20px;font-weight:600">${escapeHtml(file.name)}</td><td style="padding:10px 12px;border-bottom:1px solid #e4e8eb;color:#5f6b75;font-size:13px;line-height:20px;text-align:right">${escapeHtml(file.detail)}</td></tr>`).join('')}</table></div>` : '';
  const proofs = input.proofs?.length ? `<div style="margin-top:24px"><h2 style="margin:0 0 6px;color:#182633;font-size:16px;line-height:23px">Comprobante visual</h2><p style="margin:0 0 12px;color:#53606b;font-size:14px;line-height:21px">La imagen también se adjunta al correo para conservar el archivo original.</p>${input.proofs.map(proof => `<div style="margin:0 0 14px;padding:8px;border:1px solid #dfe4e7;background:#f7f8f7"><img src="${escapeHtml(proof.src)}" alt="${escapeHtml(proof.name)}" style="display:block;width:100%;max-width:620px;height:auto;border:0"><div style="padding:7px 3px 1px;color:#53606b;font-size:12px;line-height:18px">${escapeHtml(proof.name)}</div></div>`).join('')}</div>` : '';
  const payment = input.paymentLink?.startsWith('https://') ? `<div style="margin-top:20px;padding:16px;border-left:4px solid #d5b45b;background:#fff9e8"><div style="margin-bottom:10px;color:#2a3640;font-size:14px;line-height:21px">Puede revisar el enlace de pago informado para este cobro:</div><a href="${escapeHtml(input.paymentLink)}" style="display:inline-block;padding:10px 15px;border-radius:4px;background:#263746;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Abrir enlace de pago</a><div style="margin-top:9px;word-break:break-all;color:#53606b;font-size:12px;line-height:18px">${escapeHtml(input.paymentLink)}</div></div>` : '';
  const accountant = input.responsibleName?.trim() ? `<div style="font-weight:700;color:#182633">${escapeHtml(input.responsibleName.trim())}</div>` : '';
  const reply = input.replyTo?.trim() ? `Las respuestas a este correo serán recibidas en ${escapeHtml(input.replyTo.trim())}.` : 'Para consultas, responda directamente a este correo.';

  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef1f2"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#eef1f2"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;border-collapse:collapse;background:#ffffff"><tr><td style="padding:22px 28px;background:#263746">${logo}</td></tr><tr><td style="padding:30px 28px 8px"><div style="margin-bottom:8px;color:#8a6d28;font-size:12px;line-height:18px;font-weight:700;letter-spacing:.7px;text-transform:uppercase">${escapeHtml(input.eyebrow)}</div><h1 style="margin:0;color:#182633;font-size:25px;line-height:32px;font-weight:700">${escapeHtml(input.title)}</h1><p style="margin:8px 0 0;color:#53606b;font-size:15px;line-height:23px">${escapeHtml(input.clientName)} · ${escapeHtml(input.periodOrConcept)}</p></td></tr><tr><td style="padding:20px 28px 30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #dfe4e7">${rows}</table><div style="margin-top:24px;color:#303d48;font-size:15px;line-height:24px">${input.bodyHtml}</div>${payment}${files}${proofs}<div style="margin-top:28px;padding-top:20px;border-top:1px solid #dfe4e7;color:#53606b;font-size:14px;line-height:21px">Saludos cordiales,<br>${accountant}<div style="font-weight:700;color:#182633">Netz Asesorías</div></div></td></tr><tr><td style="padding:16px 28px;background:#f3f5f4;color:#53606b;font-size:13px;line-height:20px">${reply} Si necesita aclarar antecedentes, use <strong>Responder a todos</strong> para mantener al equipo responsable incluido.</td></tr></table></td></tr></table></body></html>`;
}
