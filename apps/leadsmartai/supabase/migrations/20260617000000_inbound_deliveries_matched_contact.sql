-- Phase 2B: link inbound email deliveries to a suggested CRM contact.
--
-- The webhook will parse the `from` header and look up
-- `contacts.email` for the routed agent. When a match exists, store
-- it here so the review page can offer it as a one-click buyer/seller
-- suggestion on the "Open in upload" CTA.
--
-- Soft FK semantics — `on delete set null`:
--   * If the contact gets deleted later, the delivery row stays so
--     the historical email record isn't lost.
--   * The review page falls back to "no match" rather than 404'ing.
--
-- Suggested-not-confirmed: this column is the AI/heuristic guess,
-- not the agent's confirmed answer. Agents who hit "Different person"
-- on the review page bypass it entirely; we don't overwrite the
-- column when they do, so we keep audit visibility into "what we
-- guessed" vs "what they picked." If we ever need a confirmed
-- contact column, that gets added separately.

alter table public.inbound_email_deliveries
  add column if not exists matched_contact_id uuid
    references public.contacts(id) on delete set null;

create index if not exists inbound_email_deliveries_matched_contact_idx
  on public.inbound_email_deliveries (matched_contact_id)
  where matched_contact_id is not null;
