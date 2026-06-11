-- RealtorBoss: fifth team member — the AI Accountant ("get you paid
-- faster", modeled on HelmSmart's Alex / AI Finance Director). Owns
-- the existing money features: invoices, expenses, commission pipeline.
--
-- Widens the assistant-type CHECK constraints and seeds the finance
-- skills. Per-agent ai_assistants rows seed lazily from the roster on
-- the next /api/dashboard/realtorboss/team call — no backfill needed.

alter table public.ai_assistants
  drop constraint if exists ai_assistants_type_check;
alter table public.ai_assistants
  add constraint ai_assistants_type_check check (
    type in ('boss_assistant', 'receptionist', 'sales_assistant', 'transaction_assistant', 'accountant')
  );

alter table public.assistant_activities
  drop constraint if exists assistant_activities_assistant_type_check;
alter table public.assistant_activities
  add constraint assistant_activities_assistant_type_check check (
    assistant_type in ('boss_assistant', 'receptionist', 'sales_assistant', 'transaction_assistant', 'accountant')
  );

insert into public.ai_skills (key, name, description, category, default_prompt) values
  ('invoice_tracking', 'Invoice Tracking', 'Track invoices from draft through sent, overdue, and paid.', 'finance', 'Track every invoice''s status; surface anything unpaid past its due date the same day it slips, with client name and amount.'),
  ('payment_reminders', 'Payment Reminders', 'Chase money owed — politely and persistently.', 'finance', 'When an invoice is overdue, recommend a follow-up. Precise and trustworthy — chase money owed without nagging the client.'),
  ('expense_tracking', 'Expense Tracking', 'Monitor business spending by category.', 'finance', 'Track expenses by category; summarize monthly spend; flag unusual jumps. Never give tax advice.'),
  ('commission_tracking', 'Commission Tracking', 'Watch the commission pipeline from active deals to paid.', 'finance', 'Track expected commissions (gross, splits, referral fees, net); flag deals closing soon with incomplete commission details.')
on conflict (key) do nothing;
