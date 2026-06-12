-- RealtorBoss — Boss instruction task EXECUTION (architecture unfrozen).
--
-- Phase 1 of the AI-workforce execution loop: when the Boss Assistant
-- routes a task to the Sales Assistant (text/email a lead) or the
-- Accountant (chase a receivable), the assistant now DRAFTS the real
-- message — matched contact, channel, body — and parks it on the task
-- as 'awaiting_approval'. The Realtor approves on the Boss card and
-- the message actually sends (Twilio/Resend); rejecting dismisses it.
-- Nothing sends without approval (spec §2.4 spirit).

alter table public.boss_instruction_tasks
  drop constraint if exists boss_instruction_tasks_status_check;
alter table public.boss_instruction_tasks
  add constraint boss_instruction_tasks_status_check check (
    status in (
      'assigned', 'needs_review', 'awaiting_approval',
      'sent', 'done', 'dismissed', 'failed'
    )
  );

alter table public.boss_instruction_tasks
  add column if not exists matched_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists draft_channel text check (draft_channel in ('sms', 'email')),
  add column if not exists draft_subject text,
  add column if not exists draft_body text,
  add column if not exists executed_at timestamptz,
  add column if not exists execution_note text;

comment on column public.boss_instruction_tasks.draft_body is
  'The message the assistant drafted for this task. status=awaiting_approval → the Realtor approves (really sends via Twilio/Resend) or dismisses on the Boss card.';
