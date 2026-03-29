-- Fix seeded template placeholders (simple {placeholder} replacement only)

update public.message_templates
set template_text = 'Hi {name}, quick follow-up on your home value request.\n\nYour estimated home value: {home_value}.\n\nIf you want, reply to this email and your agent ({agent_name}) will walk you through next steps for pricing and timing.\n\nCity: {city}\n\n— PropertyTools AI'
where lower(lead_type) = 'seller' and lower(channel) = 'email';

