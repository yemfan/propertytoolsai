/** Relative paths for LeadSmart CRM mobile routes (prefix with API base URL). */
export const MOBILE_API_PATHS = {
  inbox: "/api/mobile/inbox",
  dashboard: "/api/mobile/dashboard",
  agenda: "/api/mobile/agenda",
  dailyAgenda: "/api/mobile/daily-agenda",
  leads: "/api/mobile/leads",
  lead: (leadId: string) => `/api/mobile/leads/${encodeURIComponent(leadId)}`,
  leadSmsSend: (leadId: string) =>
    `/api/mobile/leads/${encodeURIComponent(leadId)}/sms/send`,
  leadSmsAiReply: (leadId: string) =>
    `/api/mobile/leads/${encodeURIComponent(leadId)}/sms/ai-reply`,
  leadEmailSend: (leadId: string) =>
    `/api/mobile/leads/${encodeURIComponent(leadId)}/email/send`,
  leadEmailAiReply: (leadId: string) =>
    `/api/mobile/leads/${encodeURIComponent(leadId)}/email/ai-reply`,
  pushRegister: "/api/mobile/push/register",
  tasks: "/api/mobile/tasks",
  task: (taskId: string) => `/api/mobile/tasks/${encodeURIComponent(taskId)}`,
  leadPipelineStage: (leadId: string) =>
    `/api/mobile/leads/${encodeURIComponent(leadId)}/pipeline-stage`,
  calendarEvents: "/api/mobile/calendar/events",
  calendarEvent: (eventId: string) =>
    `/api/mobile/calendar/events/${encodeURIComponent(eventId)}`,
  calendarBookingLink: "/api/mobile/calendar/booking-link",
  reminders: "/api/mobile/reminders",
  notifications: "/api/mobile/notifications",
  notificationPreferences: "/api/mobile/notification-preferences",
  leadQueue: "/api/dashboard/lead-queue",
  leadQueueClaim: "/api/dashboard/lead-queue/claim",
  cma: "/api/mobile/cma",
  postcards: "/api/mobile/postcards",
  postcardTemplates: "/api/mobile/postcards/templates",
  showings: "/api/mobile/showings",
  showing: (id: string) =>
    `/api/mobile/showings/${encodeURIComponent(id)}`,
  showingFeedback: (id: string) =>
    `/api/mobile/showings/${encodeURIComponent(id)}/feedback`,
} as const;
