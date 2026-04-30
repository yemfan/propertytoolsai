-- Agent branding: editable brand name, email signature, and logo.
alter table public.agents
  add column if not exists brand_name text,
  add column if not exists signature_html text,
  add column if not exists logo_url text;

comment on column public.agents.brand_name is 'Agent-editable brand name for email signatures and client-facing content.';
comment on column public.agents.signature_html is 'Custom HTML email signature block (optional).';
comment on column public.agents.logo_url is 'Agent/brokerage logo URL for presentations and emails.';
