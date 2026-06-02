-- Public storage bucket for expense receipt photos. Uploads go through the
-- service-role client (apps/leadsmartai/app/api/mobile/expenses/receipt), which
-- bypasses storage RLS, so no insert/update policies are needed. The bucket is
-- public-read so the stable getPublicUrl() links render in the web Expenses
-- list and the mobile app. Receipt paths are unguessable (agentId/uuid.ext).

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = excluded.public;
