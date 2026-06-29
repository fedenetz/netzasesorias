import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody } from './_shared';
import { sendF29AdminReviewNotice } from './_f29-document-status';

type Input = {
  f29_period_id?: string;
  document_id?: string;
};

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const context = await authenticate(event);
    const input = parseBody<Input>(event);
    const periodId = String(input.f29_period_id ?? '');
    if (!periodId) return json(400, { error: 'El periodo F29 es obligatorio.' });
    const emailLogId = await sendF29AdminReviewNotice({
      supabase: context.supabase,
      actorId: context.user.id,
      periodId,
      documentId: input.document_id ? String(input.document_id) : undefined,
    });
    return json(200, { email_log_id: emailLogId, to: 'richard@ainahue.cl' });
  } catch (error) {
    return functionError(error);
  }
};
