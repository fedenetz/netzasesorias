-- Operational usability: client metadata, Drive freshness and document classification provenance.
alter type public.document_kind add value if not exists 'excel';
alter type public.document_kind add value if not exists 'pdf';
alter type public.document_kind add value if not exists 'certificate';
alter type public.document_kind add value if not exists 'receipt';
alter type public.document_kind add value if not exists 'contract';

alter table public.clients
  add column if not exists tax_regime text,
  add column if not exists legal_type text,
  add column if not exists legal_representative_email text,
  add column if not exists economic_activity text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists bank_name text,
  add column if not exists checking_account text,
  add column if not exists accounting_type text check (accounting_type is null or accounting_type in ('simplified', 'complete')),
  add column if not exists last_drive_scan_at timestamptz;

alter table public.documents
  add column if not exists inferred_document_type public.document_kind,
  add column if not exists classification_source text not null default 'inferred'
    check (classification_source in ('inferred', 'manual'));

alter table public.client_services
  add column if not exists plan_name text,
  add column if not exists is_subscribed boolean not null default true;

create index if not exists documents_period_path_idx
  on public.documents (client_id, document_type, modified_at desc);

