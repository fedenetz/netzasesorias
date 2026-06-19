import type { BillingStatus } from './types';

export const effectiveBillingStatus = (status: BillingStatus, dueDate: string | null, paidAt: string | null): BillingStatus =>
  status !== 'paid' && !paidAt && dueDate && dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : status;
