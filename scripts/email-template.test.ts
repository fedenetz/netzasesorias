import assert from 'node:assert/strict';
import test from 'node:test';
import { renderNetzEmail } from '../src/shared/email-template';

test('renders the production F29 structure and inline proof reference', () => {
  const html = renderNetzEmail({
    title: 'Formulario 29 del período', eyebrow: 'Información tributaria', clientName: 'Cliente Uno', periodOrConcept: 'Mayo 2026', bodyHtml: '<p>Revise los antecedentes.</p>',
    summary: [{ label: 'Monto informado', value: '$120.000' }], attachments: [{ name: 'f29.xlsx', detail: 'Exportado desde Google Drive · Excel' }], proofs: [{ name: 'comprobante.png', src: 'cid:proof-2' }], responsibleName: 'Camila Soto', replyTo: 'control@example.com',
  });
  assert.match(html, /Netz Asesorías/);
  assert.match(html, /Monto informado/);
  assert.match(html, /f29\.xlsx/);
  assert.match(html, /src="cid:proof-2"/);
  assert.match(html, /Camila Soto/);
  assert.match(html, /Contabilidad · Tributación · Gestión/);
  assert.match(html, /Concepción, Chile/);
});

test('renders cobranza values and an explicit HTTPS payment link', () => {
  const html = renderNetzEmail({
    title: 'Recordatorio de pago', eyebrow: 'Comunicación de cobranza', clientName: 'Cliente Dos', periodOrConcept: 'Honorarios mayo', bodyHtml: '<p>Recordatorio cordial.</p>',
    summary: [{ label: 'Monto pendiente', value: '$80.000' }, { label: 'Vencimiento', value: '20-06-2026' }], paymentLink: 'https://pagos.example.com/abc',
  });
  assert.match(html, /Honorarios mayo/);
  assert.match(html, /\$80\.000/);
  assert.match(html, /https:\/\/pagos\.example\.com\/abc/);
  assert.match(html, /Abrir enlace de pago/);
});
