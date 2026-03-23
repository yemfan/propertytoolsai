-- Standard values for public.user_profiles.role (text; enforced in app code).
-- Includes broker + support for LeadSmart AI / PropertyTools dashboards.
-- @see apps/leadsmart-ai/docs/USER_ROLES.md

comment on column public.user_profiles.role is
'Application role (examples): user, agent, broker, support, admin, broker_owner, managing_broker, team_lead, brokerage_admin, owner, partner, anonymous.';
