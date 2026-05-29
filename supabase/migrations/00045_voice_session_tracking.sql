-- Voice session tracking: call duration + recording URL
alter table voice_sessions
  add column if not exists duration_seconds integer,
  add column if not exists recording_url text;
