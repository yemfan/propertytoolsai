-- Voice clone workflow: consent, sample storage paths, activation gate, extended status values.

alter table public.agent_voice_settings
  add column if not exists consent_confirmed boolean not null default false;

alter table public.agent_voice_settings
  add column if not exists consent_confirmed_at timestamptz null;

alter table public.agent_voice_settings
  add column if not exists voice_clone_sample_storage_path text null;

alter table public.agent_voice_settings
  add column if not exists voice_clone_preview_storage_path text null;

alter table public.agent_voice_settings
  add column if not exists voice_clone_error text null;

alter table public.agent_voice_settings
  add column if not exists use_cloned_voice boolean not null default false;

alter table public.agent_voice_settings
  add column if not exists voice_clone_preview_acknowledged_at timestamptz null;

comment on column public.agent_voice_settings.consent_confirmed is 'Agent consented to voice cloning terms before sample upload.';
comment on column public.agent_voice_settings.use_cloned_voice is 'When true and clone is ready, use provider clone id for TTS; Twilio still falls back to preset until Play URL wired.';
comment on column public.agent_voice_settings.voice_clone_preview_acknowledged_at is 'Agent confirmed they reviewed the clone preview before activation is allowed.';

alter table public.agent_voice_settings
  drop constraint if exists agent_voice_settings_voice_clone_status_check;

alter table public.agent_voice_settings
  add constraint agent_voice_settings_voice_clone_status_check
  check (
    voice_clone_status is null
    or voice_clone_status in ('uploaded', 'processing', 'pending', 'ready', 'failed')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-voice-clones',
  'agent-voice-clones',
  false,
  26214400,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
