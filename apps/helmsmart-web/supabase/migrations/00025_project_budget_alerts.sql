-- Week 31: project budget-burn alerts.
-- Tracks the highest budget threshold (0 / 80 / 100) already alerted for a
-- project, so each threshold notifies at most once. Ratchets upward; reset to
-- 0 when the budget changes so a raised budget can re-arm alerts.

alter table projects
  add column if not exists budget_alert_level smallint not null default 0;
