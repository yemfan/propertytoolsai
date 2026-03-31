-- Per-agent phone assistant voice (Twilio playback today; OpenAI/ElevenLabs IDs reserved for future TTS / Realtime).

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.agent_voice_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        provider text not null default 'openai'
          check (provider in ('openai', 'elevenlabs')),
        preset_voice_id text not null default 'openai_alloy',
        speaking_style text not null default 'friendly'
          check (speaking_style in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh')),
        bilingual_enabled boolean not null default true,
        voice_clone_provider text null,
        voice_clone_remote_id text null,
        voice_clone_status text null
          check (voice_clone_status is null or voice_clone_status in ('pending', 'ready', 'failed')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_voice_settings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        provider text not null default 'openai'
          check (provider in ('openai', 'elevenlabs')),
        preset_voice_id text not null default 'openai_alloy',
        speaking_style text not null default 'friendly'
          check (speaking_style in ('friendly', 'professional', 'luxury')),
        default_language text not null default 'en'
          check (default_language in ('en', 'zh')),
        bilingual_enabled boolean not null default true,
        voice_clone_provider text null,
        voice_clone_remote_id text null,
        voice_clone_status text null
          check (voice_clone_status is null or voice_clone_status in ('pending', 'ready', 'failed')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for agent_voice_settings: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_agent_voice_settings_agent
  on public.agent_voice_settings(agent_id);

comment on table public.agent_voice_settings is 'Phone assistant TTS voice: provider + preset; Twilio Polly mapping until OpenAI/ElevenLabs audio is wired. Clone columns reserved for future custom voices.';

comment on column public.agent_voice_settings.voice_clone_remote_id is 'Future: provider-side voice id after cloning (e.g. ElevenLabs voice_id).';
