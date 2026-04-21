-- Seed: 15 canonical Chinese (zh) drip templates.
--
-- Content drafted by Claude, native-speaker-reviewed by @yemfan
-- (see conversation 2026-04-21). Every entry is idempotent via
-- ON CONFLICT DO NOTHING so re-runs and partial rollbacks are safe.
--
-- Convention for this seed:
--   * `language` = 'zh' (Simplified Chinese, mainland conventions)
--   * `variant_of` = NULL — English canonical parents aren't seeded in
--     this repo yet, so these ship as standalone zh parents. When
--     English parents land, a follow-up migration sets `variant_of`
--     on each row to the corresponding en id. Template lookup code
--     already handles both the parent-only and parent+variant shapes
--     (see lib/locales/templateLookup.ts).
--   * `source` = 'invented' — flags that these are drafted copy that
--     should be reviewed + iterated against live agent data, not
--     content from an authoritative spec.
--   * `default_status` = 'review' for EVERY template. Even birthday +
--     holiday messages are review-gated on first ship so agents opt
--     in per-template. Product can upgrade individual templates to
--     'autosend' once a pilot agent validates tone.
--   * Placeholder convention: {{lead_name}}, {{agent_name}},
--     {{property_address}}, {{tour_time}}, {{closing_date}},
--     {{market_city}}, {{median_price}}, {{median_dom}},
--     {{yoy_change}}, {{low_estimate}}, {{high_estimate}}.
--     Downstream renderer prefers "<surname>先生/女士" form for
--     {{lead_name}} when gender is known, falls through to the raw
--     name string otherwise.
--   * SMS templates are kept ≤70 Chinese chars where possible so
--     each message is one UCS-2 segment on Twilio ($0.0075 vs the
--     $0.0150 of 2-segment sends).
--   * English terms kept inline when that's what bilingual US agents
--     actually say to mainland-origin clients: `offer`, `escrow`,
--     `close`, `CMA`, `Wire transfer`, `Title insurance`. Descriptive
--     terms translated: `refinance` → 重新贷款,
--     `Comparative Market Analysis` → 比较市场分析.

-- ── lead_response ─────────────────────────────────────────────────────

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_first_response_sms',
  'lead_response',
  '首次回复 · 新咨询',
  'sms',
  null,
  $t$您好{{lead_name}}！感谢您的咨询。请问您目前是在考虑买房、卖房，还是想先了解一下市场？我很乐意为您提供帮助。$t$,
  'zh',
  null,
  '["lead_name"]'::jsonb,
  'review',
  'invented',
  'Sent within the first minute of a new inbound lead. Formal 您 register; open-ended qualifier question.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_first_response_email',
  'lead_response',
  '首次回复 · 新咨询 (邮件)',
  'email',
  $t$感谢您咨询{{market_city}}房产$t$,
  $t$您好{{lead_name}}，

感谢您的咨询。我是{{agent_name}}，{{market_city}}地区的房产经纪人。

请问您目前主要在考虑哪类房产？例如：
• 自住房（首套 / 换房）
• 投资房
• 暂时只是了解市场行情

方便的话也请告诉我您的预算区间和心仪的区域，我可以为您筛选合适的房源，或者安排时间电话沟通。

期待您的回复。

{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "market_city", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Longer-form counterpart to zh_lead_first_response_sms. Same timing window; used when lead came in via email rather than SMS.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_followup_24h_sms',
  'lead_response',
  '24 小时未回复跟进',
  'sms',
  null,
  $t$您好{{lead_name}}，我是{{agent_name}}。不知您是否看到昨天我的消息？如果现在不方便，随时联系我都可以。$t$,
  'zh',
  null,
  '["lead_name", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Sent ~24h after zh_lead_first_response_sms if no inbound reply. Deliberately low-pressure — no hard question.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_followup_48h_email',
  'lead_response',
  '48 小时未回复跟进 (邮件)',
  'email',
  $t$还有什么我可以帮到您的吗？$t$,
  $t$您好{{lead_name}}，

想简单再跟进一下——如果您暂时不方便深聊，完全没关系。我把自己当成一个可以随时问问题的资源：不管是想大致了解{{market_city}}近期的成交价位，还是某个具体街区、学区、通勤情况，都可以直接问我，不需要承诺任何后续动作。

如果您已经不再考虑，也可以回复我一声，我就不再打扰您。

祝好，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "market_city", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Second-touch follow-up at ~48h. Offers a graceful opt-out in the last paragraph so leads who never intended to engage can close the loop without guilt.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lead_tour_interest_qualifier_sms',
  'lead_response',
  '看房意向确认',
  'sms',
  null,
  $t$您好{{lead_name}}，看到您对 {{property_address}} 感兴趣。方便的话我这周可以安排带您实地看看。您哪天方便？$t$,
  'zh',
  null,
  '["lead_name", "property_address"]'::jsonb,
  'review',
  'invented',
  'Triggered by a "request info" click on a specific listing. Moves the thread from "abstract interest" to "scheduled tour".'
)
on conflict (id) do nothing;

-- ── lifecycle ─────────────────────────────────────────────────────────

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_tour_confirmation_sms',
  'lifecycle',
  '看房前 24 小时确认',
  'sms',
  null,
  $t$您好{{lead_name}}，明天 {{tour_time}} 在 {{property_address}} 看房，约定不变。到时见！—{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "tour_time", "property_address", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Day-before tour reminder. Low-pressure — confirms the appointment without asking for a reply. Safe candidate for autosend once piloted.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_tour_recap_email',
  'lifecycle',
  '看房后跟进 (邮件)',
  'email',
  $t${{property_address}} 看房后续$t$,
  $t$您好{{lead_name}}，

感谢您今天抽时间一起去看 {{property_address}}。方便的话可以跟我说说实际感受——哪些方面符合预期、哪些不太合适。

如果这套房子让您觉得值得继续推进，我可以帮您：
• 准备一份这个区域近期的可比成交分析
• 起草 offer，包括合理的出价区间和条件

如果这套不合适也没关系，我根据您今天的反馈再帮您筛选几套更贴近需求的。

期待您的消息。

{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Sent ~2h after a tour ends. Offers two forks: continue with this property (CMA + offer prep) or pivot (new listings). Low-pressure either way.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_offer_submitted_sms',
  'lifecycle',
  'Offer 已提交',
  'sms',
  null,
  $t$您好{{lead_name}}，您的 offer 已经正式提交给卖方经纪。有任何回复我会第一时间通知您。$t$,
  'zh',
  null,
  '["lead_name"]'::jsonb,
  'review',
  'invented',
  'Sent immediately after the offer package is submitted to the listing agent. Uses the English word "offer" because that is how mainland-origin US buyers actually refer to it.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_offer_accepted_sms',
  'lifecycle',
  'Offer 接受',
  'sms',
  null,
  $t$恭喜{{lead_name}}！您的 offer 已被接受，{{property_address}} 即将进入 escrow。接下来的步骤我稍后发邮件详细说明。$t$,
  'zh',
  null,
  '["lead_name", "property_address"]'::jsonb,
  'review',
  'invented',
  'Celebration + bridge to the next step. Deliberately defers detail to a follow-up email so the SMS stays short (1 UCS-2 segment).'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_lifecycle_closing_confirmed_email',
  'lifecycle',
  '交易即将完成 (邮件)',
  'email',
  $t$恭喜——{{property_address}} 交易即将完成$t$,
  $t${{lead_name}}，

正式恭喜您！{{property_address}} 的交易定于 {{closing_date}} 正式 close。

交割前您需要准备的几样材料：
• 政府签发的身份证明（护照或驾照）
• Wire transfer 的确认函
• Title insurance（产权保险）的最终文件

如果您有任何问题或需要我陪同办理，随时联系我。

祝贺！
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "closing_date", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Sent when the closing date is confirmed. Keeps transaction-critical anglicisms (close / Wire transfer / Title insurance) because the real documents use them.'
)
on conflict (id) do nothing;

-- ── sphere ────────────────────────────────────────────────────────────

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_birthday_sms',
  'sphere',
  '生日祝福',
  'sms',
  null,
  $t${{lead_name}}，祝您生日快乐，身体健康，万事顺心！—{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Birthday wish for contacts with a known DOB. Intentionally short + non-transactional.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_chinese_new_year_sms',
  'sphere',
  '新春祝福',
  'sms',
  null,
  $t${{lead_name}}，新春快乐！祝您和家人在新的一年身体健康，万事如意。—{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Chinese New Year. Intentionally generic (no zodiac year) so the template does not need annual rewrites. Zodiac-year variants can live as one-off messages per cycle if product wants.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_quarterly_market_checkin_email',
  'sphere',
  '季度市场简报 (邮件)',
  'email',
  $t${{market_city}} 本季度房产市场简报$t$,
  $t$您好{{lead_name}}，

简单跟您更新一下{{market_city}}本季度的市场情况：
• 成交中位价：{{median_price}} 美元
• 平均在售天数：{{median_dom}} 天
• 与去年同期对比：{{yoy_change}}

这些只是大方向参考，具体到您关心的区域或价位段，情况可能会有不同。如果需要更细的数据或者针对某处房产分析，随时告诉我。

祝好，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "market_city", "median_price", "median_dom", "yoy_change", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Quarterly data-forward touch for sphere contacts. Values come from the market-report pipeline.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_annual_home_value_update_email',
  'sphere',
  '年度房屋估值更新 (邮件)',
  'email',
  $t${{property_address}} 的最新估值（年度更新）$t$,
  $t$您好{{lead_name}}，

距离您购入 {{property_address}} 已经一年了。根据{{market_city}}近期的成交数据，这套房子目前的估值区间大约在 {{low_estimate}}–{{high_estimate}} 美元。

说明一下：
• 这只是基于近期可比成交的参考估值，不等于市场挂牌价
• 实际价格还要看房屋目前的状况、装修和具体街区细节
• 如果您希望了解更精准的数字（比如考虑换房、重新贷款 或者纯粹好奇），我可以帮您做一份正式的 CMA（比较市场分析）

另外，如果您身边有朋友也在考虑买房或卖房，随时可以让他们直接联系我。

祝您一切顺利，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "market_city", "low_estimate", "high_estimate", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Past-client anniversary touch. Notes: (1) "refinance" translated to 重新贷款 per native-speaker review; (2) "CMA (Comparative Market Analysis)" expanded as "CMA (比较市场分析)" for clarity.'
)
on conflict (id) do nothing;

insert into public.templates (
  id, category, name, channel, subject, body, language, variant_of,
  placeholders, default_status, source, notes
) values (
  'zh_sphere_referral_ask_email',
  'sphere',
  '转介绍请求 (邮件)',
  'email',
  $t$一点小请求$t$,
  $t$您好{{lead_name}}，

希望您入住 {{property_address}} 一切顺利。

有一个小请求——如果您身边的朋友、同事或家人也在考虑买房或卖房，希望您能把我推荐给他们。我绝不会打扰或纠缠您的朋友；只有在他们主动联系我时才会跟进。

如果您愿意，也可以直接把这封邮件或者微信转发给他们，让他们回复即可。

无论如何，再次感谢您给我机会帮您完成这次交易。

诚挚感谢，
{{agent_name}}$t$,
  'zh',
  null,
  '["lead_name", "property_address", "agent_name"]'::jsonb,
  'review',
  'invented',
  'Referral ask ~30 days post-closing. Intentionally soft per native-speaker note: "I will not pursue your friends uninvited." Mentions WeChat as a forwarding channel (per review 2026-04-21).'
)
on conflict (id) do nothing;
