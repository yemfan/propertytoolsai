-- Week 30: link an estimate to the project it spawned.
-- Mirrors the existing estimates.converted_invoice_id pattern.

alter table estimates
  add column if not exists converted_project_id uuid references projects(id) on delete set null;
