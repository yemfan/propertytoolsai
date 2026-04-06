import type { PlanTemplate } from "./types";

/**
 * {{name}} and {{address}} are replaced at generation time with lead data.
 */

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    key: "buyer_nurture",
    title: "Buyer Nurture Sequence",
    description: "Warm up buyer leads with market updates, property alerts, and check-ins over 14 days.",
    trigger_type: "new_lead",
    steps: [
      {
        channel: "email",
        action: "send_email",
        subject: "Welcome — let's find your perfect home",
        body: "Hi {{name}}, thanks for reaching out! I'd love to help you find the right property. What's your timeline and must-have list? Reply anytime.",
        delay_days: 0,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, this is your agent. Just sent you an email — let me know your must-haves and I'll start sending matches!",
        delay_days: 1,
      },
      {
        channel: "task",
        action: "create_task",
        body: "Call {{name}} to discuss buying criteria and timeline",
        delay_days: 2,
      },
      {
        channel: "email",
        action: "send_email",
        subject: "New listings that might interest you",
        body: "Hi {{name}}, I've been keeping an eye on the market for you. Here are a few properties that match what you're looking for. Let me know if any catch your eye!",
        delay_days: 5,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, just checking in — have you had a chance to look at those listings I sent? Happy to schedule tours anytime.",
        delay_days: 7,
      },
      {
        channel: "email",
        action: "send_email",
        subject: "Market update for your area",
        body: "Hi {{name}}, quick market update: inventory in your target area is moving fast. Let's connect this week to make sure you don't miss anything great.",
        delay_days: 14,
      },
    ],
  },
  {
    key: "seller_nurture",
    title: "Seller Nurture Sequence",
    description: "Engage seller leads with home value insights, CMA offers, and listing strategy over 14 days.",
    trigger_type: "new_lead",
    steps: [
      {
        channel: "email",
        action: "send_email",
        subject: "Your home value report is ready",
        body: "Hi {{name}}, thanks for checking your home value! Based on recent sales near {{address}}, I've put together some insights. Want a detailed CMA? Just reply.",
        delay_days: 0,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, I sent over your home value report. Homes in your area are selling well — happy to discuss your options anytime.",
        delay_days: 1,
      },
      {
        channel: "task",
        action: "create_task",
        body: "Call {{name}} to discuss selling timeline and offer CMA",
        delay_days: 3,
      },
      {
        channel: "email",
        action: "send_email",
        subject: "What your neighbors are selling for",
        body: "Hi {{name}}, here's a quick look at recent sales in your neighborhood. The market is strong right now — timing could work in your favor. Let me know if you'd like a personalized pricing strategy.",
        delay_days: 7,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, homes like yours at {{address}} are in demand. If you're thinking about selling, I can walk you through the numbers — no pressure.",
        delay_days: 10,
      },
      {
        channel: "email",
        action: "send_email",
        subject: "Free listing consultation",
        body: "Hi {{name}}, I'd love to offer you a free listing consultation. We'll review your home's value, discuss staging tips, and create a marketing plan tailored to your property. Interested?",
        delay_days: 14,
      },
    ],
  },
  {
    key: "new_listing",
    title: "New Listing Announcement",
    description: "Promote a new listing to interested leads with property highlights and showing invitations.",
    trigger_type: "new_listing",
    steps: [
      {
        channel: "email",
        action: "send_email",
        subject: "Just listed: {{address}}",
        body: "Hi {{name}}, exciting news! I just listed a property at {{address}} that might be perfect for you. It features great value for the area. Want to schedule a showing?",
        delay_days: 0,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, new listing alert! {{address}} just hit the market. Let me know if you'd like to see it — these go fast!",
        delay_days: 1,
      },
      {
        channel: "task",
        action: "create_task",
        body: "Follow up with {{name}} about new listing at {{address}}",
        delay_days: 3,
      },
      {
        channel: "notification",
        action: "send_notification",
        body: "Reminder: follow up with {{name}} about {{address}} listing interest",
        delay_days: 5,
      },
    ],
  },
  {
    key: "recent_sale",
    title: "Recent Sale Follow-Up",
    description: "Leverage a recent sale to generate seller interest from nearby homeowners.",
    trigger_type: "recent_sale",
    steps: [
      {
        channel: "email",
        action: "send_email",
        subject: "A home near you just sold!",
        body: "Hi {{name}}, a property near {{address}} just sold — and it might affect your home's value. Want to know what yours is worth now? I can run a quick analysis for you.",
        delay_days: 0,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, a home near you just sold. Curious what it means for your property value? Happy to share the details.",
        delay_days: 2,
      },
      {
        channel: "task",
        action: "create_task",
        body: "Send {{name}} a detailed CMA based on the recent sale near {{address}}",
        delay_days: 4,
      },
    ],
  },
  {
    key: "stale_reengagement",
    title: "Stale Lead Re-engagement",
    description: "Re-engage leads that haven't responded in 30+ days with fresh value and a soft check-in.",
    trigger_type: "stale_lead",
    steps: [
      {
        channel: "email",
        action: "send_email",
        subject: "Still thinking about real estate?",
        body: "Hi {{name}}, it's been a while since we connected. The market has changed — want a fresh look at what's available or what your home is worth now? No rush, just here when you're ready.",
        delay_days: 0,
      },
      {
        channel: "sms",
        action: "send_sms",
        body: "Hi {{name}}, just checking in! If real estate is still on your mind, I'm here to help. Let me know if anything has changed.",
        delay_days: 3,
      },
      {
        channel: "task",
        action: "create_task",
        body: "Call {{name}} for re-engagement — offer updated market insights",
        delay_days: 5,
      },
    ],
  },
];

export function getTemplate(key: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((t) => t.key === key);
}
