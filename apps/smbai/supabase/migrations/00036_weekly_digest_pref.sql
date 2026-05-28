-- Week 56: weekly digest opt-out.
-- Per-org toggle for the Monday owner digest (Week 55). Defaults on; the digest
-- cron skips orgs where this is false.

alter table organizations
  add column if not exists weekly_digest_enabled boolean not null default true;
