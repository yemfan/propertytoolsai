-- Seed: all 27 canonical English template rows.
--
-- Why a migration for data that was previously script-seeded:
--   * The JSON source (apps/propertytoolsai/docs/proptotypes/…) was
--     untracked in git, so the canonical-library state drifted between
--     environments depending on which operator ran the seed script.
--   * With this migration, `templates` reaches a deterministic shape on
--     every db push. Re-runs + double-seeds are no-ops thanks to
--     ON CONFLICT DO NOTHING, so the existing seed-message-templates.mjs
--     workflow continues to function without surprise.
--
-- Content: 20 pre-existing canonicals (verbatim from the JSON)
--          + 7 new canonicals introduced this PR:
--            LR-TINT, LR-TR, LR-OS, LR-OA, LR-CC (transaction milestones)
--            BD-01, RA-01E (sphere additions)

-- HA-01 · sphere · sms · Home anniversary
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'HA-01', 'sphere', 'Home anniversary', 'sms',
  null,
  $body$Hey {{first_name}} — hard to believe it's been {{years}} year{{s}} since we closed on {{street_name}}. Hope you're still loving the place. Current estimated value is {{avm_display}} (up {{delta_display}} from when you bought). If you ever want me to run a deeper look, just say the word. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "time_local": "09:00", "frequency": "yearly", "requires": ["anniversary_opt_in=true", "relationship_type in [past_buyer_client, past_seller_client]"]}'::jsonb,
  $note$No autosend in first 30 days of agent onboarding.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- HA-01E · sphere · email · Home anniversary · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'HA-01E', 'sphere', 'Home anniversary · email variant', 'email',
  $subj${{years}} year{{s}} in your {{street_name}} home$subj$,
  $body$Hi {{first_name}},

Can't believe it's been {{years}} year{{s}}. I still remember the night we went back and forth with the seller on the inspection — you handled it better than most agents I know.

Your home at {{street_name}} is currently estimated at {{avm_display}}. That's {{delta_display}} above what you paid — not that you're going anywhere, but it's good to know.

If you ever want me to pull the comps or look at what a refi might do for you, I'm a text away. Otherwise — enjoy the place.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "paired_with": "HA-01", "condition": "contact has email_on_file=true"}'::jsonb,
  $note$Expansion of spec §2.5 HA-01b. Pair with HA-01 SMS for full-contact clients.$note$,
  'review', 'spec_expanded'
) on conflict (id) do nothing;

-- EQ-01 · sphere · email · Quarterly equity update
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'EQ-01', 'sphere', 'Quarterly equity update', 'email',
  $subj${{quarter}} update on your {{neighborhood}} home$subj$,
  $body${{first_name}},

Quick quarterly snapshot on your place at {{street_name}}.

Purchased {{closing_date_short}} for {{closing_price_display}}. Currently estimated at {{avm_display}} — {{delta_pct}}% above purchase, roughly {{delta_display}} in equity.

Two things worth noting in {{neighborhood}} this quarter: median price is {{median_price}}, and days on market {{dom_change_phrase}} versus last quarter.

If you ever want me to break down what this means for your plans — refi, rental, selling — just hit reply. No pitch, promise.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "street_name", "closing_date_short", "closing_price_display", "avm_display", "delta_pct", "delta_display", "quarter", "neighborhood", "median_price", "dom_change_phrase", "agent_first_name"]'::jsonb,
  '{"type": "calendar_quarter_start", "requires": ["relationship_type in [past_buyer_client, past_seller_client]", "agent_of_record_match=true"]}'::jsonb,
  $note$`dom_change_phrase` should render as 'shortened from 18 to 12 days' or 'lengthened from 12 to 18 days'.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- EM-01 · sphere · sms · Equity milestone · crossed +25%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'EM-01', 'sphere', 'Equity milestone · crossed +25%', 'sms',
  null,
  $body$Quick heads-up, {{first_name}} — your place on {{street_name}} just crossed 25% equity growth since you bought. Estimated value is now around {{avm_display}}. Not suggesting you do anything with it — just wanted you to know. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "street_name", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.25, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$The 'not suggesting you do anything' line is load-bearing. Keeps it from feeling like a pitch.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- EM-02 · sphere · sms · Equity milestone · crossed +50%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'EM-02', 'sphere', 'Equity milestone · crossed +50%', 'sms',
  null,
  $body${{first_name}}, milestone moment: your {{street_name}} place just crossed 50% equity gained since you bought it in {{closing_year}}. That puts it around {{avm_display}}. Congrats — you picked well. If you ever want to talk through what that opens up, I'm here. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "street_name", "closing_year", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.5, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$Warmer than EM-01 because 50% is a real milestone worth acknowledging.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- DR-01 · sphere · sms · Dormant re-engage
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'DR-01', 'sphere', 'Dormant re-engage', 'sms',
  null,
  $body$Hey {{first_name}}, realized it's been a minute. How are things? Anyone in your circle thinking about a move this spring? No pressure — just keeping a list. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "season"]'::jsonb,
  '{"type": "dormancy", "field": "last_touch_date", "threshold_days": 120, "frequency": "once", "suppress_if": "any_signal_fired_within_30_days"}'::jsonb,
  $note$Rotate 'spring' to 'summer/fall/winter' by month. {{season}} placeholder is dynamically populated.$note$,
  'review', 'spec'
) on conflict (id) do nothing;

-- RA-01 · sphere · sms · Referral thank-you
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'RA-01', 'sphere', 'Referral thank-you', 'sms',
  null,
  $body${{first_name}} — {{referral_name}} just reached out because of you. That means more than you know. I'll take great care of them. Thank you. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_cites_this_contact_as_referrer", "latency_max_hours": 2}'::jsonb,
  $note$Send within 2 hours of referral intake. Timing is the whole point.$note$,
  'autosend', 'spec'
) on conflict (id) do nothing;

-- JS-01 · sphere · sms · Just sold in your neighborhood
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'JS-01', 'sphere', 'Just sold in your neighborhood', 'sms',
  null,
  $body${{first_name}} — {{address_short}} just sold for {{sold_price}}. Two houses from you. Thought you'd want to know what that does for your neighborhood comps. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "address_short", "sold_price", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "comparable_sale_within_half_mile", "requires": ["same_zip", "sq_ft_within_15pct"], "frequency_cap": "1_per_90_days_per_contact"}'::jsonb,
  $note$Requires MLS feed. Frequency cap is important — neighbors get annoyed by over-sending.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-Z01 · lead_response · sms · Zillow buyer inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-Z01', 'lead_response', 'Zillow buyer inquiry · first touch', 'sms',
  null,
  $body$Hi {{first_name}}, this is {{agent_first_name}} with {{brokerage}} — saw you asked about {{property_address}}. Are you hoping to tour this weekend or just gathering info for now?$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "brokerage", "property_address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "latency_max_seconds": 60}'::jsonb,
  $note$From spec §1.5 verbatim. The weekend/info binary is the whole trick.$note$,
  'autosend', 'spec'
) on conflict (id) do nothing;

-- LR-Z02 · lead_response · email · Zillow buyer inquiry · first touch · email
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-Z02', 'lead_response', 'Zillow buyer inquiry · first touch · email', 'email',
  $subj$About {{property_short_address}}$subj$,
  $body$Hi {{first_name}},

Saw your note come through about {{property_address}} — nice place. Three bed, {{bathrooms}} bath, {{square_footage}} sq ft if I remember the listing right.

Quick question so I can be useful: are you looking to tour this weekend, or still in the research phase? Either way I can send you two or three similar listings in {{neighborhood}} that might be a better fit — I know a few that haven't hit Zillow yet.

Text me back at {{agent_phone}} if that's easier than email. Talk soon.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_address", "property_short_address", "bathrooms", "square_footage", "neighborhood", "agent_phone", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "paired_with": "LR-Z01", "delay_after_sms_seconds": 120}'::jsonb,
  $note$Only use 'haven't hit Zillow yet' line if agent has real pocket listings.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LR-Z03 · lead_response · sms · Zillow seller inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-Z03', 'lead_response', 'Zillow seller inquiry · first touch', 'sms',
  null,
  $body$Hi {{first_name}}, this is {{agent_first_name}} with {{brokerage}}. Saw you looked up a value for {{address}}. Happy to send over a real CMA — more accurate than the Zestimate. Are you thinking of selling soon or just checking the number?$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "brokerage", "address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_seller", "latency_max_seconds": 60}'::jsonb,
  $note$CMA vs Zestimate is the differentiator. Sellers already know they're not the same thing.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LR-OH01 · lead_response · sms · Open-house sign-in · follow-up
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-OH01', 'lead_response', 'Open-house sign-in · follow-up', 'sms',
  null,
  $body$Hey {{first_name}} — {{agent_first_name}} here, we met at the {{property_address}} open house this afternoon. Wanted to say thanks for stopping by. What'd you think? Was it in the running, or more of a drive-by?$body$,
  'en',
  null,
  '["first_name", "agent_first_name", "property_address"]'::jsonb,
  '{"type": "event", "event": "open_house_sign_in", "delay_hours": 3, "condition": "after_open_house_end"}'::jsonb,
  $note$'In the running or drive-by' gives permission to disqualify without rudeness.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-NR01 · lead_response · sms · No-reply follow-up · day 2
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-NR01', 'lead_response', 'No-reply follow-up · day 2', 'sms',
  null,
  $body$Hey {{first_name}} — quick one. A few new listings hit today in {{neighborhood}} under {{price_max}}. Want me to send the shortlist? (It's a pretty short list.)$body$,
  'en',
  null,
  '["first_name", "neighborhood", "price_max"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_hours": {"min": 36, "max": 48}, "frequency": "once", "requires": "agent_has_new_listings_in_neighborhood=true"}'::jsonb,
  $note$Suppress if no real listings to share. Do not send a generic 'just following up'.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-NR02 · lead_response · sms · No-reply follow-up · day 7 · opt-out
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-NR02', 'lead_response', 'No-reply follow-up · day 7 · opt-out', 'sms',
  null,
  $body$Last one from me, {{first_name}} — if {{neighborhood}} isn't right or the timing's off, totally fine. I'll stop texting. But if you want me to keep an eye out for anything specific, text me what you'd actually want and I'll watch for it.$body$,
  'en',
  null,
  '["first_name", "neighborhood"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_days": 7, "frequency": "once", "next_state": "slow_drip"}'::jsonb,
  $note$The 'I'll stop texting' opt-out often triggers a reply. Withdrawal of attention prompts engagement.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-TOUR · lead_response · sms · Tour confirmation
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-TOUR', 'lead_response', 'Tour confirmation', 'sms',
  null,
  $body$Locked in, {{first_name}}: {{tour_day}} at {{tour_time}}, {{property_address}}. I'll meet you out front — I drive a {{agent_car}} if that helps. Park anywhere on the street. Text if anything changes. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "tour_day", "tour_time", "property_address", "agent_car", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "tour_scheduled", "latency_max_seconds": 30}'::jsonb,
  $note${{agent_car}} set during agent onboarding. Removes parking-lot awkwardness at tour start.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-W01 · lifecycle · email · Welcome · signup + 2 min
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-W01', 'lifecycle', 'Welcome · signup + 2 min', 'email',
  $subj$You're in. Here's what happens next.$subj$,
  $body${{first_name}},

Welcome. Your trial is live — 14 days, no credit card, cancel anytime.

Three things that'll take you ten minutes total:

1 — Connect a lead source. Zillow, Follow Up Boss, your IDX, Facebook Lead Ads. Whatever you have. {{connect_url}}

2 — Record a 30-second voice sample. This is how we teach the AI to sound like you, not like a bot. {{voice_url}}

3 — Send yourself a test lead. Paste a name and phone into the test lead form — LeadSmart will reply to you as if you were a real Zillow inquiry. See what it sounds like before a real lead sees it.

That's it. Real leads start getting real replies the moment a source is connected.

If you're stuck, reply to this email. A real person answers — usually within the hour.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "connect_url", "voice_url"]'::jsonb,
  '{"type": "event", "event": "trial_signup", "delay_minutes": 2}'::jsonb,
  $note$No exclamation points. No 'welcome aboard'. 'Real person answers' must be true.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-FS · lifecycle · email · First success · first lead replied
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-FS', 'lifecycle', 'First success · first lead replied', 'email',
  $subj$Your first lead just replied.$subj$,
  $body${{first_name}},

At {{reply_time}} today, {{lead_name}} replied to the message LeadSmart sent on your behalf. That reply is waiting in your inbox.

Worth noting: {{lead_name}} came in from {{source}} at {{arrival_time}}. First reply went out at {{first_reply_time}} — {{reply_latency}} seconds later.

That's the whole product in one transaction. The next 500 leads work the same way.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "reply_time", "lead_name", "source", "arrival_time", "first_reply_time", "reply_latency"]'::jsonb,
  '{"type": "event", "event": "first_lead_reply_ever", "latency_max_minutes": 5}'::jsonb,
  $note$Most important email in the lifecycle. The 'aha' moment. Keep it short, no CTA.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-TE · lifecycle · email · Trial ending · day 12
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-TE', 'lifecycle', 'Trial ending · day 12', 'email',
  $subj$48 hours left on your trial.$subj$,
  $body${{first_name}},

Your trial ends {{trial_end_date}}. Two days from now.

In the 12 days so far: {{leads_received}} leads came in, {{leads_replied}} replied, {{tours_booked}} tours got booked. Median first-reply time: {{median_latency}} seconds.

No auto-charge when the trial ends. If you do nothing, you drop to the free tier (25 leads a month, email only) and keep everything you've built so far.

If you want to keep the SMS side of things — which is roughly where the speed comes from — Pro is $49 a month, cancel anytime. {{upgrade_url}}

Either way, thanks for the trial.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "trial_end_date", "leads_received", "leads_replied", "tours_booked", "median_latency", "upgrade_url"]'::jsonb,
  '{"type": "date_before_trial_end", "hours_before": 48, "requires": "leads_replied_count >= 1"}'::jsonb,
  $note$No urgency theater. Honest admission about the free-tier fallback.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-CR · lifecycle · email · Churn recovery · cancel + 30 days
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-CR', 'lifecycle', 'Churn recovery · cancel + 30 days', 'email',
  $subj$Quick one — was it us?$subj$,
  $body${{first_name}},

You cancelled LeadSmart a month ago. Hope things are going well.

I'm not writing to ask you back. I'm writing to ask what we did wrong — honestly, no marketing angle.

Was it the price? The integrations? Did the AI sound off in your voice? Something broke? Did you hire someone?

If you have thirty seconds, reply with a sentence. I read these myself.

— {{founder_first_name}}, founder$body$,
  'en',
  null,
  '["first_name", "founder_first_name"]'::jsonb,
  '{"type": "date_after_cancellation", "days_after": 30, "frequency": "once", "signed_by": "founder"}'::jsonb,
  $note$Only email signed by a named person. Must actually be from the founder. Must actually be read.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LC-RA · lifecycle · email · Reactivation · cancel + 90 days
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LC-RA', 'lifecycle', 'Reactivation · cancel + 90 days', 'email',
  $subj$What changed in the last 90 days.$subj$,
  $body${{first_name}},

Three months since you left. A few things are different:

— Native integration with Follow Up Boss (no more Zapier for FUB users).

— Median first-reply time is down to {{current_median_latency}} seconds (was {{old_median_latency}} when you had the trial).

— Home-anniversary and past-client messaging is live. That's the piece a lot of agents left looking for.

If any of that lands, the door's open — same account, same settings. {{reactivate_url}}

If not, no worries. Best of luck out there.

— The LeadSmart team$body$,
  'en',
  null,
  '["first_name", "current_median_latency", "old_median_latency", "reactivate_url"]'::jsonb,
  '{"type": "date_after_cancellation", "days_after": 90, "frequency": "once", "suppress_if": "replied_to=LC-CR"}'::jsonb,
  $note$Only mention features that actually exist. Never bluff.$note$,
  'autosend', 'invented'
) on conflict (id) do nothing;

-- LR-TINT · lead_response · sms · Listing interest · tour qualifier
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-TINT', 'lead_response', 'Listing interest · tour qualifier', 'sms',
  null,
  $body$Saw you pulled up {{property_address}}, {{first_name}}. Weekend walkthrough, mid-week, or neither? If neither, I can send two or three in {{area}} that might fit better — tell me what you liked about this one and I'll filter for it.$body$,
  'en',
  null,
  '["first_name", "property_address", "area"]'::jsonb,
  '{"type": "event", "event": "listing_page_request_info", "requires": ["consent_sms=true"]}'::jsonb,
  $note$Binary (weekend/mid-week) + optional pivot. Mirrors LR-Z01's structure but for a request-info click rather than a Zillow inbound.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-TR · lead_response · email · Tour recap · 2h post-tour
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-TR', 'lead_response', 'Tour recap · 2h post-tour', 'email',
  $subj${{property_short_address}} — thoughts?$subj$,
  $body${{first_name}},

Thanks for the tour today. When you've had a minute, tell me what stuck and what didn't — specific reactions are more useful to me than a pro/con list.

If it's a maybe, I can pull {{neighborhood}} comps from the last 90 days and draft an offer range with contingencies. No commitment — just the numbers so you can decide.

If it's a pass, fair enough. I'll re-filter based on what you reacted to today and send two or three closer to what you're actually after.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_short_address", "neighborhood", "agent_first_name"]'::jsonb,
  '{"type": "time_offset", "after_event": "tour_end", "offset_minutes": 120}'::jsonb,
  $note$'Specific reactions are more useful than a pro/con list' invites a real conversation rather than a polite summary.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-OS · lead_response · sms · Offer submitted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-OS', 'lead_response', 'Offer submitted', 'sms',
  null,
  $body$Offer's in with the listing agent, {{first_name}}. Response deadline is {{response_deadline}}. I'll text the second we hear back — nothing for you to do in the meantime. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "response_deadline", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_submitted"}'::jsonb,
  $note$'Nothing for you to do in the meantime' is load-bearing — waiting on offer response is the single most anxious period in a deal.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-OA · lead_response · sms · Offer accepted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-OA', 'lead_response', 'Offer accepted', 'sms',
  null,
  $body$They accepted, {{first_name}}. {{property_short_address}} heads into escrow. Step-by-step in your inbox tonight. Nice work holding your number. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_short_address", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_accepted"}'::jsonb,
  $note$'Holding your number' acknowledges negotiating discipline without hyperbole. Short intentionally — celebration + bridge to the detail email.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- LR-CC · lead_response · email · Closing confirmed
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'LR-CC', 'lead_response', 'Closing confirmed', 'email',
  $subj$Closing set — {{property_short_address}}, {{closing_date_short}}$subj$,
  $body${{first_name}},

We're closing {{property_short_address}} on {{closing_date_short}} at {{closing_time}}.

Bring to the signing table:
— government-issued photo ID (passport or driver's license)
— wire-transfer confirmation receipt
— final title insurance documents (I'll forward these 48 hours ahead)

If you want me there with you — say the word. Otherwise, keep your phone on and I'll let you know the second keys are ready.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "property_short_address", "closing_date_short", "closing_time", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "closing_date_set"}'::jsonb,
  $note$Checklist format avoids the emotional pressure of closing day. Offering to be there in person is the most valuable thing a good agent does at this stage.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- BD-01 · sphere · sms · Birthday
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'BD-01', 'sphere', 'Birthday', 'sms',
  null,
  $body$Happy birthday, {{first_name}}. Hope today's a good one. — {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "date_of_birth", "time_local": "09:00", "frequency": "yearly", "requires": ["date_of_birth != null"]}'::jsonb,
  $note$Deliberately short. Anything longer reads as a birthday wish dressed up like a sales touch.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- RA-01E · sphere · email · Referral thank-you · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'RA-01E', 'sphere', 'Referral thank-you · email variant', 'email',
  $subj$Thanks for sending {{referral_name}}.$subj$,
  $body${{first_name}},

{{referral_name}} reached out because of you. That means more than you probably realize.

I'll take care of them the way I took care of you. When the deal closes — if they're okay with me telling you — you'll hear from me.

Thank you.

— {{agent_first_name}}$body$,
  'en',
  null,
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "referral_inbound", "paired_with": "RA-01"}'::jsonb,
  $note$Email variant of RA-01 for agents whose referring clients prefer email. 'If they're okay with me telling you' respects referral-confidentiality norms without being legalistic.$note$,
  'review', 'invented'
) on conflict (id) do nothing;
