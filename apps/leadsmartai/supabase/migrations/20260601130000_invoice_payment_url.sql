-- Optional "pay online" link per invoice (the realtor's Stripe Payment Link,
-- PayPal.me, etc.). Shown as a Pay button in the invoice email + PDF.
alter table public.invoices
  add column if not exists payment_url text;

comment on column public.invoices.payment_url is
  'Optional payment link (Stripe Payment Link / PayPal / etc.) shown on the invoice email + PDF.';
