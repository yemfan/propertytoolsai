-- Week 52: campaign targeting by client tag.
-- Optional tag segment on a campaign — combined with the existing status
-- recipient_filter (e.g. "active clients tagged VIP", or any client tagged
-- "wholesale" when the status filter is "all").

alter table campaigns
  add column if not exists recipient_tag text;
