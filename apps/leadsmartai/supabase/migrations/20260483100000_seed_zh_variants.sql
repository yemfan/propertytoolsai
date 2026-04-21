-- Seed: 22 Simplified-Chinese (zh) template variants + 1 zh-standalone.
--
-- Each variant:
--   * has `variant_of` pointing at the English canonical in
--     20260483050000_seed_en_canonicals.sql (runs earlier by filename
--     prefix, so parents exist when variants insert)
--   * uses the canonical placeholder names verbatim ({{first_name}},
--     {{street_name}}, {{agent_first_name}}, etc.)
--   * inherits the parent's trigger_config so both language versions
--     fire on the same event; renderer picks variant vs parent via
--     lib/locales/templateLookup.ts + the lead's preferred_language
--   * ships at default_status='review' regardless of parent's status —
--     bilingual agents opt in per-template during pilot.
--
-- Content written by Claude, native-speaker-reviewed by @yemfan
-- (conversation 2026-04-21). Follows the outbound tone directive in
-- lib/locales/registry.ts: formal 您 register, mainland conventions,
-- no investment-guarantee / FOMO phrasing, Arabic digits, 美元 for USD,
-- transaction-critical anglicisms preserved (offer, escrow, close,
-- CMA, Wire transfer, Title insurance), descriptive terms translated
-- (refinance -> 重新贷款, Comparative Market Analysis -> 比较市场分析).
--
-- Not translated (stays English only): the 5 LC-* subscription-lifecycle
-- templates. Those are LeadSmart-the-product emailing the agent, not the
-- agent messaging their leads, so they stay in the dashboard's UI
-- language (currently English-only until zh.ui.enabled flips in a later
-- PR with 100% message-catalog coverage).

-- variant of HA-01 · sphere · sms · Home anniversary
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ha_01', 'sphere', 'Home anniversary · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}——不知不觉，{{street_name}} 签约已经 {{years}} 年了。希望您依然住得舒心。这套房目前估值大约 {{avm_display}}（比当初购入高出 {{delta_display}}）。哪天想让我帮您更深入看一下，说一声就行。—{{agent_first_name}}$body$,
  'zh',
  'HA-01',
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "time_local": "09:00", "frequency": "yearly", "requires": ["anniversary_opt_in=true", "relationship_type in [past_buyer_client, past_seller_client]"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of HA-01E · sphere · email · Home anniversary · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ha_01e', 'sphere', 'Home anniversary · email variant · 简体中文', 'email',
  $subj${{street_name}} 入住满 {{years}} 年$subj$,
  $body$您好{{first_name}}，

{{years}} 年了。我还记得当年跟卖方在 inspection 上反复磋商的那晚——您处理得比我认识的大多数经纪都沉稳。

您在 {{street_name}} 的这套房子目前估值大约 {{avm_display}}——比购入价高出 {{delta_display}}。不是说您要卖，只是让您心里有数。

哪天想让我帮您拉 comps，或者看看重新贷款能带来什么变化，一条短信的事。不然就好好享受您的家。

—{{agent_first_name}}$body$,
  'zh',
  'HA-01E',
  '["first_name", "years", "s", "street_name", "avm_display", "delta_display", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "closing_date", "paired_with": "HA-01", "condition": "contact has email_on_file=true"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of EQ-01 · sphere · email · Quarterly equity update
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_eq_01', 'sphere', 'Quarterly equity update · 简体中文', 'email',
  $subj${{neighborhood}} {{quarter}} 房产快照$subj$,
  $body${{first_name}}，

简单给您一个季度快照——关于您 {{street_name}} 的房子。

购入时间 {{closing_date_short}}，购入价 {{closing_price_display}}。目前估值 {{avm_display}}——比购入价高 {{delta_pct}}%，约 {{delta_display}} 的 equity。

{{neighborhood}} 本季度值得留意的两点：成交中位价 {{median_price}}，在售天数 {{dom_change_phrase}}（相对上季度）。

如果您想知道这些数据对您的重新贷款、出租或出售计划意味着什么，回复即可。不是推销，真的。

—{{agent_first_name}}$body$,
  'zh',
  'EQ-01',
  '["first_name", "street_name", "closing_date_short", "closing_price_display", "avm_display", "delta_pct", "delta_display", "quarter", "neighborhood", "median_price", "dom_change_phrase", "agent_first_name"]'::jsonb,
  '{"type": "calendar_quarter_start", "requires": ["relationship_type in [past_buyer_client, past_seller_client]", "agent_of_record_match=true"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of EM-01 · sphere · sms · Equity milestone · crossed +25%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_em_01', 'sphere', 'Equity milestone · crossed +25% · 简体中文', 'sms',
  null,
  $body$小提醒，{{first_name}}——您 {{street_name}} 的房子刚越过 25% 升值线，目前估值约 {{avm_display}}。不是说您需要做什么，只是让您知道一下。—{{agent_first_name}}$body$,
  'zh',
  'EM-01',
  '["first_name", "street_name", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.25, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of EM-02 · sphere · sms · Equity milestone · crossed +50%
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_em_02', 'sphere', 'Equity milestone · crossed +50% · 简体中文', 'sms',
  null,
  $body${{first_name}}，里程碑时刻：您 {{closing_year}} 年买的 {{street_name}} 刚突破 50% 升值。目前估值约 {{avm_display}}。恭喜——眼光不错。如果想聊聊这意味着什么，我一直在。—{{agent_first_name}}$body$,
  'zh',
  'EM-02',
  '["first_name", "street_name", "closing_year", "avm_display", "agent_first_name"]'::jsonb,
  '{"type": "threshold_crossed", "field": "equity_pct", "threshold": 0.5, "direction": "upward", "frequency": "once_per_milestone"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of DR-01 · sphere · sms · Dormant re-engage
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_dr_01', 'sphere', 'Dormant re-engage · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}，好久没联络了。近况如何？您身边有朋友在考虑{{season}}搬家吗？没有压力——只是在整理名单。—{{agent_first_name}}$body$,
  'zh',
  'DR-01',
  '["first_name", "agent_first_name", "season"]'::jsonb,
  '{"type": "dormancy", "field": "last_touch_date", "threshold_days": 120, "frequency": "once", "suppress_if": "any_signal_fired_within_30_days"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of RA-01 · sphere · sms · Referral thank-you
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ra_01', 'sphere', 'Referral thank-you · 简体中文', 'sms',
  null,
  $body${{first_name}}——{{referral_name}} 刚因为您主动联系了我。这份信任意义重大，我会用心对待他们。谢谢您。—{{agent_first_name}}$body$,
  'zh',
  'RA-01',
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_cites_this_contact_as_referrer", "latency_max_hours": 2}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of JS-01 · sphere · sms · Just sold in your neighborhood
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_js_01', 'sphere', 'Just sold in your neighborhood · 简体中文', 'sms',
  null,
  $body${{first_name}}——{{address_short}} 刚以 {{sold_price}} 成交，离您家就两栋房子。这对您街区的 comps 可能有影响，想着您会想知道。—{{agent_first_name}}$body$,
  'zh',
  'JS-01',
  '["first_name", "address_short", "sold_price", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "comparable_sale_within_half_mile", "requires": ["same_zip", "sq_ft_within_15pct"], "frequency_cap": "1_per_90_days_per_contact"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of BD-01 · sphere · sms · Birthday
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_bd_01', 'sphere', 'Birthday · 简体中文', 'sms',
  null,
  $body${{first_name}}，生日快乐！希望今天过得开心。—{{agent_first_name}}$body$,
  'zh',
  'BD-01',
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_anniversary", "field": "date_of_birth", "time_local": "09:00", "frequency": "yearly", "requires": ["date_of_birth != null"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of RA-01E · sphere · email · Referral thank-you · email variant
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_ra_01e', 'sphere', 'Referral thank-you · email variant · 简体中文', 'email',
  $subj$感谢您把 {{referral_name}} 介绍给我$subj$,
  $body${{first_name}}，

{{referral_name}} 刚因为您主动联系了我。这份信任可能比您意识到的还要珍贵。

我会像当年照顾您一样照顾他们。交易完成之后——如果他们同意我告诉您——我会让您知道。

谢谢。

—{{agent_first_name}}$body$,
  'zh',
  'RA-01E',
  '["first_name", "referral_name", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "referral_inbound", "paired_with": "RA-01"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-Z01 · lead_response · sms · Zillow buyer inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_z01', 'lead_response', 'Zillow buyer inquiry · first touch · 简体中文', 'sms',
  null,
  $body$您好{{first_name}}，我是{{brokerage}}的{{agent_first_name}}——看到您咨询了 {{property_address}}。您是希望这个周末看房，还是目前先收集信息？$body$,
  'zh',
  'LR-Z01',
  '["first_name", "agent_first_name", "brokerage", "property_address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "latency_max_seconds": 60}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-Z02 · lead_response · email · Zillow buyer inquiry · first touch · email
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_z02', 'lead_response', 'Zillow buyer inquiry · first touch · email · 简体中文', 'email',
  $subj$关于 {{property_short_address}}$subj$,
  $body$您好{{first_name}}，

看到您咨询了 {{property_address}}——位置不错。如果我没记错挂牌信息的话，三卧、{{bathrooms}} 浴、{{square_footage}} 平方英尺。

一个快速问题，方便我更有针对性：您是想这个周末看房，还是还在前期了解阶段？不管哪种，我都可以给您发 2–3 套 {{neighborhood}} 附近类似的房源——其中有几套目前还没挂上 Zillow。

如果发短信比邮件方便，我的号码 {{agent_phone}}。期待回复。

—{{agent_first_name}}$body$,
  'zh',
  'LR-Z02',
  '["first_name", "property_address", "property_short_address", "bathrooms", "square_footage", "neighborhood", "agent_phone", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_buyer", "paired_with": "LR-Z01", "delay_after_sms_seconds": 120}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-Z03 · lead_response · sms · Zillow seller inquiry · first touch
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_z03', 'lead_response', 'Zillow seller inquiry · first touch · 简体中文', 'sms',
  null,
  $body$您好{{first_name}}，我是{{brokerage}}的{{agent_first_name}}。看到您查询了 {{address}} 的估值。我可以给您出一份正式的 CMA（比较市场分析）——比 Zestimate 精确得多。您是近期考虑出售，还是先看看数字？$body$,
  'zh',
  'LR-Z03',
  '["first_name", "agent_first_name", "brokerage", "address"]'::jsonb,
  '{"type": "event", "event": "new_lead_arrived", "source": "zillow_seller", "latency_max_seconds": 60}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-OH01 · lead_response · sms · Open-house sign-in · follow-up
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_oh01', 'lead_response', 'Open-house sign-in · follow-up · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}——我是今天下午 {{property_address}} open house 见过的{{agent_first_name}}。谢谢您过来看看。感觉如何？是在认真考虑，还是顺便看看？$body$,
  'zh',
  'LR-OH01',
  '["first_name", "agent_first_name", "property_address"]'::jsonb,
  '{"type": "event", "event": "open_house_sign_in", "delay_hours": 3, "condition": "after_open_house_end"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-NR01 · lead_response · sms · No-reply follow-up · day 2
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_nr01', 'lead_response', 'No-reply follow-up · day 2 · 简体中文', 'sms',
  null,
  $body$嘿{{first_name}}——简短的：今天 {{neighborhood}} 新挂了几套 {{price_max}} 以下的房源。要不要我把清单发给您？（其实就那么几套。）$body$,
  'zh',
  'LR-NR01',
  '["first_name", "neighborhood", "price_max"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_hours": {"min": 36, "max": 48}, "frequency": "once", "requires": "agent_has_new_listings_in_neighborhood=true"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-NR02 · lead_response · sms · No-reply follow-up · day 7 · opt-out
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_nr02', 'lead_response', 'No-reply follow-up · day 7 · opt-out · 简体中文', 'sms',
  null,
  $body$这是我最后一次跟进，{{first_name}}——如果 {{neighborhood}} 不对、或者时机不合适，完全没问题，我就不再发信息了。如果您希望我帮您留意某种具体的房源，告诉我大致方向，我会替您盯着。$body$,
  'zh',
  'LR-NR02',
  '["first_name", "neighborhood"]'::jsonb,
  '{"type": "inactivity", "reference": "first_touch_sent", "threshold_days": 7, "frequency": "once", "next_state": "slow_drip"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-TOUR · lead_response · sms · Tour confirmation
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_tour', 'lead_response', 'Tour confirmation · 简体中文', 'sms',
  null,
  $body$约定好了，{{first_name}}：{{tour_day}} {{tour_time}}，{{property_address}} 门口见。我开一辆 {{agent_car}}，您可以在街边随便停。有任何变动随时短信告诉我。—{{agent_first_name}}$body$,
  'zh',
  'LR-TOUR',
  '["first_name", "tour_day", "tour_time", "property_address", "agent_car", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "tour_scheduled", "latency_max_seconds": 30}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-TINT · lead_response · sms · Listing interest · tour qualifier
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_tint', 'lead_response', 'Listing interest · tour qualifier · 简体中文', 'sms',
  null,
  $body$看到您关注 {{property_address}}，{{first_name}}。周末实地看看，还是工作日更方便？都不行也没关系——告诉我这套您喜欢什么，我可以发 2–3 套 {{area}} 附近更贴近的。$body$,
  'zh',
  'LR-TINT',
  '["first_name", "property_address", "area"]'::jsonb,
  '{"type": "event", "event": "listing_page_request_info", "requires": ["consent_sms=true"]}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-TR · lead_response · email · Tour recap · 2h post-tour
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_tr', 'lead_response', 'Tour recap · 2h post-tour · 简体中文', 'email',
  $subj${{property_short_address}} 感觉如何？$subj$,
  $body${{first_name}}，

感谢您今天一起看房。方便的时候跟我说说感受——具体反应比一二三罗列的优缺点对我更有用。

如果还在考虑这一套，我可以拉 {{neighborhood}} 近 90 天的 comps，起草一份 offer 报价区间和条件。不代表要提交——只是让您看到实际数字再决定。

如果这套不合适也没关系。我根据您今天的反应再筛 2–3 套更贴近的发您。

—{{agent_first_name}}$body$,
  'zh',
  'LR-TR',
  '["first_name", "property_short_address", "neighborhood", "agent_first_name"]'::jsonb,
  '{"type": "time_offset", "after_event": "tour_end", "offset_minutes": 120}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-OS · lead_response · sms · Offer submitted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_os', 'lead_response', 'Offer submitted · 简体中文', 'sms',
  null,
  $body$Offer 已正式提交给卖方经纪，{{first_name}}。对方需在 {{response_deadline}} 前回复。有任何消息我会第一时间告诉您——中间您什么都不用做。—{{agent_first_name}}$body$,
  'zh',
  'LR-OS',
  '["first_name", "response_deadline", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_submitted"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-OA · lead_response · sms · Offer accepted
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_oa', 'lead_response', 'Offer accepted · 简体中文', 'sms',
  null,
  $body$对方接受了，{{first_name}}。{{property_short_address}} 正式进入 escrow。今晚会发邮件详细说明步骤。出价守得漂亮。—{{agent_first_name}}$body$,
  'zh',
  'LR-OA',
  '["first_name", "property_short_address", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "offer_accepted"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- variant of LR-CC · lead_response · email · Closing confirmed
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_lr_cc', 'lead_response', 'Closing confirmed · 简体中文', 'email',
  $subj$交易确认——{{property_short_address}}，{{closing_date_short}}$subj$,
  $body${{first_name}}，

我们定了：{{closing_date_short}} {{closing_time}}，{{property_short_address}} 完成交割。

签署时请准备：
— 政府签发的身份证件（护照或驾照）
— Wire transfer 的确认回执
— Title insurance（产权保险）最终文件（我会在 48 小时前转发给您）

如果您希望我陪同办理，随时告诉我。否则保持手机通畅，钥匙交接我第一时间联系您。

—{{agent_first_name}}$body$,
  'zh',
  'LR-CC',
  '["first_name", "property_short_address", "closing_date_short", "closing_time", "agent_first_name"]'::jsonb,
  '{"type": "event", "event": "closing_date_set"}'::jsonb,
  $note$Simplified Chinese variant. Placeholder set mirrors the English parent; trigger inherits the parent's config. Native-speaker-reviewed 2026-04-21. default_status is 'review' on first ship regardless of parent so agents opt in per-template.$note$,
  'review', 'invented'
) on conflict (id) do nothing;

-- Standalone Chinese New Year greeting (no English canonical).
insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, trigger_config, notes, default_status, source
) values (
  'zh_sphere_chinese_new_year_sms', 'sphere', '新春祝福 · 简体中文', 'sms',
  null,
  $body${{first_name}}，新春快乐！祝您和家人在新的一年身体健康，万事如意。—{{agent_first_name}}$body$,
  'zh', null,
  '["first_name", "agent_first_name"]'::jsonb,
  '{"type": "date_fixed", "lunar_calendar": "cny_day_1", "time_local": "09:00", "frequency": "yearly"}'::jsonb,
  $note$Culturally specific — no English parent by design. Generic zodiac-agnostic wording so it does not need annual rewrites. Only send to contacts with preferred_language='zh'.$note$,
  'review', 'invented'
) on conflict (id) do nothing;
