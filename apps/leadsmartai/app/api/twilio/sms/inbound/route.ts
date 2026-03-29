import { POST as smsWebhookPost } from "@/app/api/sms/webhook/route";

export const runtime = "nodejs";

export const POST = smsWebhookPost;
