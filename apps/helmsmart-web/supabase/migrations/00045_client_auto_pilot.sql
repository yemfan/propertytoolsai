-- Per-client AI auto-pilot for the HelmSmart AI assistant. When true, the
-- inbound SMS webhook auto-drafts + sends a contextual AI reply for this client
-- (the "Auto Pilot" toggle in the floating HelmSmart AI panel). Distinct from
-- the org-level organizations.auto_reply canned acknowledgement.

alter table public.clients
  add column if not exists auto_pilot boolean not null default false;

comment on column public.clients.auto_pilot is
  'HelmSmart AI per-client auto-pilot: inbound SMS gets an automatic AI reply.';
