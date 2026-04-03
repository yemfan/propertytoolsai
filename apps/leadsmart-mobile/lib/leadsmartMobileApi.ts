import { apiFetch, apiFetchJson } from "@leadsmart/api-client";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type {
  DailyAgendaItem,
  MobileAgentInboxNotificationDto,
  MobileBookingLinkDto,
  MobileCalendarEventDto,
  MobileCalendarEventStatus,
  MobileCalendarProvider,
  MobileDailyAgendaResponseDto,
  MobileDashboardPriorityAlert,
  MobileDashboardQuickAction,
  MobileDashboardResponse,
  MobileDashboardStats,
  MobileEmailAiReplyResponseDto,
  MobileEmailMessageDto,
  MobileFollowUpReminderDto,
  MobileInboxThreadDto,
  MobileLeadDetailResponseDto,
  MobileLeadPipelineDto,
  MobileLeadTaskDto,
  MobileLeadsListResponseDto,
  MobileNotificationPreferencesDto,
  MobileNotificationsListResponseDto,
  MobilePipelineStageOptionDto,
  MobileRemindersResponseDto,
  MobileSmsAiReplyResponseDto,
  MobileSmsMessageDto,
  MobileTasksGroupedResponseDto,
  MobileTaskPriority,
  MobileTaskStatus,
} from "@leadsmart/shared";
import { getLeadsmartAccessToken, getLeadsmartApiBaseUrl } from "./env";
import { MOBILE_API_PATHS } from "./mobileEndpoints";

type MobileJsonError = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  code?: string;
};

export type MobileApiFailure = {
  ok: false;
  status: number;
  message: string;
  code?: string;
};

export type MobileInboxSuccess = {
  ok: true;
  threads: MobileInboxThreadDto[];
  generatedAt: string;
};

export type MobileLeadsSuccess = { ok: true } & MobileLeadsListResponseDto;

export type MobileLeadDetailSuccess = { ok: true } & MobileLeadDetailResponseDto;

export type MobileDashboardSuccess = { ok: true } & MobileDashboardResponse;

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

function parseMobileFailure(
  status: number,
  body: unknown,
  fallback: string
): MobileApiFailure {
  if (body && typeof body === "object") {
    const b = body as MobileJsonError;
    return {
      ok: false,
      status,
      message: typeof b.error === "string" && b.error.trim() ? b.error : fallback,
      code: typeof b.code === "string" ? b.code : undefined,
    };
  }
  return { ok: false, status, message: fallback };
}

type MobileConfig = { base: string; token: string };

function requireConfig(): MobileApiFailure | MobileConfig {
  const base = getLeadsmartApiBaseUrl();
  const token = getLeadsmartAccessToken();
  if (!base) {
    return { ok: false, status: 0, message: "Set EXPO_PUBLIC_LEADSMART_API_URL (LeadSmart AI API base URL)." };
  }
  if (!token) {
    return {
      ok: false,
      status: 0,
      message:
        "API URL is set, but you are not signed in. Use onboarding / Login with your LeadSmart email and password (Supabase issues the JWT). Optional dev-only: EXPO_PUBLIC_LEADSMART_ACCESS_TOKEN. Setting EXPO_PUBLIC_LEADSMART_API_URL alone does not authenticate.",
    };
  }
  return { base, token };
}

function isMobileConfig(c: MobileApiFailure | MobileConfig): c is MobileConfig {
  return "base" in c && "token" in c;
}

/**
 * Authenticated GET to a mobile API path; validates `{ ok, success }` envelope when present.
 */
async function mobileGet<T extends MobileJsonError>(path: string): Promise<
  | MobileApiFailure
  | { ok: true; data: T }
> {
  const cfg = requireConfig();
  if (!isMobileConfig(cfg)) return cfg;

  const { base, token } = cfg;
  const res = await apiFetch<T>(`${base}${path}`, {
    method: "GET",
    headers: authHeaders(token),
    credentials: "omit",
  });

  if (!res.ok) {
    return parseMobileFailure(res.status, res.body, res.error);
  }

  const data = res.data;
  if (!data || data.ok === false || data.success === false) {
    return parseMobileFailure(res.status, data, "Request failed");
  }

  return { ok: true, data };
}

async function mobilePost<T extends MobileJsonError>(
  path: string,
  body: Record<string, unknown>
): Promise<MobileApiFailure | { ok: true; data: T }> {
  const cfg = requireConfig();
  if (!isMobileConfig(cfg)) return cfg;

  const { base, token } = cfg;
  const res = await apiFetchJson<T>(`${base}${path}`, body, {
    method: "POST",
    headers: authHeaders(token),
    credentials: "omit",
  });

  if (!res.ok) {
    return parseMobileFailure(res.status, res.body, res.error);
  }

  const data = res.data;
  if (!data || data.ok === false || data.success === false) {
    return parseMobileFailure(res.status, data, "Request failed");
  }

  return { ok: true, data };
}

async function mobilePatch<T extends MobileJsonError>(
  path: string,
  body: Record<string, unknown>
): Promise<MobileApiFailure | { ok: true; data: T }> {
  const cfg = requireConfig();
  if (!isMobileConfig(cfg)) return cfg;

  const { base, token } = cfg;
  const res = await apiFetchJson<T>(`${base}${path}`, body, {
    method: "PATCH",
    headers: authHeaders(token),
    credentials: "omit",
  });

  if (!res.ok) {
    return parseMobileFailure(res.status, res.body, res.error);
  }

  const data = res.data;
  if (!data || data.ok === false || data.success === false) {
    return parseMobileFailure(res.status, data, "Request failed");
  }

  return { ok: true, data };
}

type InboxJson = MobileJsonError & {
  threads?: MobileInboxThreadDto[];
  generatedAt?: string;
};

export async function fetchMobileInbox(): Promise<MobileInboxSuccess | MobileApiFailure> {
  const res = await mobileGet<InboxJson>(MOBILE_API_PATHS.inbox);
  if (res.ok === false) return res;

  const data = res.data;
  if (!Array.isArray(data.threads)) {
    return { ok: false, status: 200, message: "Invalid inbox response (missing threads)." };
  }

  return {
    ok: true,
    threads: data.threads,
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString(),
  };
}

type DashboardJson = MobileJsonError & Partial<MobileDashboardResponse>;

function isDashboardStats(x: unknown): x is MobileDashboardStats {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.hotLeads === "number" &&
    typeof s.unreadMessages === "number" &&
    typeof s.tasksToday === "number" &&
    typeof s.appointmentsToday === "number"
  );
}

function isPriorityAlertItem(x: unknown): x is MobileDashboardPriorityAlert {
  if (!x || typeof x !== "object") return false;
  const a = x as Record<string, unknown>;
  return typeof a.type === "string" && typeof a.title === "string";
}

function isQuickActionItem(x: unknown): x is MobileDashboardQuickAction {
  if (!x || typeof x !== "object") return false;
  const q = x as Record<string, unknown>;
  return typeof q.key === "string" && typeof q.label === "string";
}

export async function fetchMobileDashboard(): Promise<MobileDashboardSuccess | MobileApiFailure> {
  const res = await mobileGet<DashboardJson>(MOBILE_API_PATHS.dashboard);
  if (res.ok === false) return res;

  const data = res.data;
  if (
    !isDashboardStats(data.stats) ||
    !Array.isArray(data.priorityAlerts) ||
    !data.priorityAlerts.every(isPriorityAlertItem) ||
    !Array.isArray(data.quickActions) ||
    !data.quickActions.every(isQuickActionItem)
  ) {
    return { ok: false, status: 200, message: "Invalid dashboard response." };
  }

  return {
    ok: true as const,
    stats: data.stats,
    priorityAlerts: data.priorityAlerts,
    quickActions: data.quickActions,
  };
}

type AgendaJson = MobileJsonError & Partial<MobileDailyAgendaResponseDto>;

function isAgendaItem(x: unknown): x is DailyAgendaItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const t = o.type;
  return (
    typeof o.id === "string" &&
    (t === "task" || t === "appointment" || t === "follow_up") &&
    typeof o.title === "string" &&
    typeof o.dueAt === "string"
  );
}

/** Daily merged agenda (`GET /api/mobile/daily-agenda`). */
export async function fetchMobileDailyAgenda(params?: {
  /** UTC day `YYYY-MM-DD`; omit for today UTC. */
  date?: string;
}): Promise<({ ok: true } & MobileDailyAgendaResponseDto) | MobileApiFailure> {
  const q = new URLSearchParams();
  if (params?.date) q.set("date", params.date);
  const path = q.toString()
    ? `${MOBILE_API_PATHS.dailyAgenda}?${q.toString()}`
    : MOBILE_API_PATHS.dailyAgenda;
  const res = await mobileGet<AgendaJson>(path);
  if (res.ok === false) return res;
  const d = res.data;
  if (typeof d.agendaDate !== "string" || !Array.isArray(d.items) || !d.items.every(isAgendaItem)) {
    return { ok: false, status: 200, message: "Invalid agenda response." };
  }
  return {
    ok: true as const,
    agendaDate: d.agendaDate,
    items: d.items,
  };
}

/** @deprecated Use `fetchMobileDailyAgenda` — same endpoint. */
export const fetchMobileAgenda = fetchMobileDailyAgenda;

type LeadsJson = MobileJsonError & MobileLeadsListResponseDto;

export async function fetchMobileLeads(params: {
  page?: number;
  pageSize?: number;
  filter?: "hot" | "inactive";
}): Promise<MobileLeadsSuccess | MobileApiFailure> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 30;
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (params.filter) q.set("filter", params.filter);

  const res = await mobileGet<LeadsJson>(`${MOBILE_API_PATHS.leads}?${q.toString()}`);
  if (res.ok === false) return res;

  const data = res.data;
  if (!Array.isArray(data.leads)) {
    return { ok: false, status: 200, message: "Invalid leads response." };
  }

  return {
    ok: true as const,
    leads: data.leads,
    total: Number(data.total) || 0,
    page: Number(data.page) || page,
    pageSize: Number(data.pageSize) || pageSize,
  };
}

type LeadDetailJson = MobileJsonError & Partial<MobileLeadDetailResponseDto> & {
  lead?: MobileLeadDetailResponseDto["lead"];
  conversations?: MobileLeadDetailResponseDto["conversations"];
};

const emptyPipeline: MobileLeadPipelineDto = {
  stage_id: null,
  mobile_slug: null,
  name: null,
};

export async function fetchMobileLeadDetail(
  leadId: string
): Promise<MobileLeadDetailSuccess | MobileApiFailure> {
  const res = await mobileGet<LeadDetailJson>(MOBILE_API_PATHS.lead(leadId));
  if (res.ok === false) return res;

  const data = res.data;
  if (!data.lead || !data.conversations) {
    return { ok: false, status: 200, message: "Invalid lead detail response." };
  }

  const pipeline_stages: MobilePipelineStageOptionDto[] = Array.isArray(data.pipeline_stages)
    ? data.pipeline_stages
    : [];

  const booking_links: MobileBookingLinkDto[] = Array.isArray(data.booking_links)
    ? data.booking_links
    : [];

  return {
    ok: true as const,
    lead: data.lead,
    conversations: data.conversations,
    pipeline: data.pipeline ?? emptyPipeline,
    pipeline_stages,
    next_open_task: data.next_open_task ?? null,
    next_appointment: data.next_appointment ?? null,
    booking_links,
  };
}

type PushRegisterJson = MobileJsonError & { ok?: boolean; success?: boolean };

/**
 * Register this device’s Expo push token with LeadSmart AI (`POST /api/mobile/push/register`).
 */
export async function registerMobileExpoPushToken(
  expoPushToken: string
): Promise<{ ok: true } | MobileApiFailure> {
  const cfg = requireConfig();
  if (!isMobileConfig(cfg)) return cfg;

  const { base, token } = cfg;
  const platform =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : Platform.OS === "web"
          ? "web"
          : "unknown";

  const res = await apiFetchJson<PushRegisterJson>(
    `${base}${MOBILE_API_PATHS.pushRegister}`,
    {
      expoPushToken,
      platform,
      appVersion: Constants.expoConfig?.version ?? undefined,
    },
    { method: "POST", headers: authHeaders(token), credentials: "omit" }
  );

  if (!res.ok) {
    return parseMobileFailure(res.status, res.body, res.error);
  }

  const data = res.data;
  if (!data || data.ok === false || data.success === false) {
    return parseMobileFailure(res.status, data, "Push registration failed");
  }

  return { ok: true as const };
}

type SmsSendJson = MobileJsonError & { message?: MobileSmsMessageDto };
type EmailSendJson = MobileJsonError & { message?: MobileEmailMessageDto };
type SmsAiJson = MobileJsonError & MobileSmsAiReplyResponseDto;
type EmailAiJson = MobileJsonError & MobileEmailAiReplyResponseDto;

export async function postMobileSmsSend(
  leadId: string,
  body: string
): Promise<{ ok: true; message: MobileSmsMessageDto } | MobileApiFailure> {
  const res = await mobilePost<SmsSendJson>(MOBILE_API_PATHS.leadSmsSend(leadId), { body });
  if (res.ok === false) return res;
  const m = res.data.message;
  if (!m || typeof m.id !== "string") {
    return { ok: false, status: 200, message: "Invalid SMS send response." };
  }
  return { ok: true, message: m };
}

export async function postMobileEmailSend(
  leadId: string,
  params: { subject: string; body: string }
): Promise<{ ok: true; message: MobileEmailMessageDto } | MobileApiFailure> {
  const res = await mobilePost<EmailSendJson>(MOBILE_API_PATHS.leadEmailSend(leadId), {
    subject: params.subject,
    body: params.body,
  });
  if (res.ok === false) return res;
  const m = res.data.message;
  if (!m || typeof m.id !== "string") {
    return { ok: false, status: 200, message: "Invalid email send response." };
  }
  return { ok: true, message: m };
}

export async function postMobileSmsAiReply(
  leadId: string
): Promise<{ ok: true; suggestion: string } | MobileApiFailure> {
  const res = await mobilePost<SmsAiJson>(MOBILE_API_PATHS.leadSmsAiReply(leadId), {});
  if (res.ok === false) return res;
  const s = res.data.suggestion;
  if (typeof s !== "string" || !s.trim()) {
    return { ok: false, status: 200, message: "Invalid SMS AI response." };
  }
  return { ok: true, suggestion: s.trim() };
}

export async function postMobileEmailAiReply(
  leadId: string
): Promise<{ ok: true; subject: string; body: string } | MobileApiFailure> {
  const res = await mobilePost<EmailAiJson>(MOBILE_API_PATHS.leadEmailAiReply(leadId), {});
  if (res.ok === false) return res;
  const subject = String(res.data.subject ?? "").trim();
  const body = String(res.data.body ?? "").trim();
  if (!body) {
    return { ok: false, status: 200, message: "Invalid email AI response." };
  }
  return { ok: true, subject: subject || "Following up", body };
}

type TasksGroupedJson = MobileJsonError & Partial<MobileTasksGroupedResponseDto>;

function isTaskList(x: unknown): x is MobileLeadTaskDto[] {
  return Array.isArray(x);
}

export async function fetchMobileTasks(): Promise<
  ({ ok: true } & MobileTasksGroupedResponseDto) | MobileApiFailure
> {
  const res = await mobileGet<TasksGroupedJson>(MOBILE_API_PATHS.tasks);
  if (res.ok === false) return res;

  const data = res.data;
  if (
    !isTaskList(data.overdue) ||
    !isTaskList(data.today) ||
    !isTaskList(data.upcoming) ||
    !Array.isArray(data.stages)
  ) {
    return { ok: false, status: 200, message: "Invalid tasks response." };
  }

  return {
    ok: true as const,
    stages: data.stages as MobilePipelineStageOptionDto[],
    overdue: data.overdue,
    today: data.today,
    upcoming: data.upcoming,
  };
}

type TaskMutationJson = MobileJsonError & { task?: MobileLeadTaskDto };

export async function postMobileTask(params: {
  lead_id: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  priority?: MobileTaskPriority;
  task_type?: string | null;
}): Promise<{ ok: true; task: MobileLeadTaskDto } | MobileApiFailure> {
  const res = await mobilePost<TaskMutationJson>(MOBILE_API_PATHS.tasks, {
    lead_id: params.lead_id,
    title: params.title,
    description: params.description ?? null,
    due_at: params.due_at ?? null,
    priority: params.priority ?? "medium",
    task_type: params.task_type ?? null,
  });
  if (res.ok === false) return res;
  const task = res.data.task;
  if (!task || typeof task.id !== "string") {
    return { ok: false, status: 200, message: "Invalid create task response." };
  }
  return { ok: true, task };
}

export async function patchMobileTask(
  taskId: string,
  patch: {
    status?: MobileTaskStatus;
    title?: string;
    description?: string | null;
    due_at?: string | null;
    priority?: MobileTaskPriority;
  }
): Promise<{ ok: true; task: MobileLeadTaskDto } | MobileApiFailure> {
  const res = await mobilePatch<TaskMutationJson>(MOBILE_API_PATHS.task(taskId), patch);
  if (res.ok === false) return res;
  const task = res.data.task;
  if (!task || typeof task.id !== "string") {
    return { ok: false, status: 200, message: "Invalid update task response." };
  }
  return { ok: true, task };
}

type PipelineStagePatchJson = MobileJsonError & { pipeline_stage_id?: string | null };

export async function patchLeadPipelineStage(
  leadId: string,
  body: { stage_slug: string } | { pipeline_stage_id: string | null }
): Promise<{ ok: true; pipeline_stage_id: string | null } | MobileApiFailure> {
  const res = await mobilePatch<PipelineStagePatchJson>(
    MOBILE_API_PATHS.leadPipelineStage(leadId),
    body as Record<string, unknown>
  );
  if (res.ok === false) return res;
  const id = res.data.pipeline_stage_id;
  return {
    ok: true as const,
    pipeline_stage_id: id === undefined || id === null ? null : String(id),
  };
}

type CalendarEventsJson = MobileJsonError & { events?: MobileCalendarEventDto[] };
type CalendarEventMutationJson = MobileJsonError & { event?: MobileCalendarEventDto };
type BookingLinkJson = MobileJsonError & { booking_link?: MobileBookingLinkDto };
type RemindersJson = MobileJsonError & Partial<MobileRemindersResponseDto>;

function isEventList(x: unknown): x is MobileCalendarEventDto[] {
  return Array.isArray(x);
}

export async function fetchMobileCalendarEvents(params?: {
  from?: string;
  to?: string;
}): Promise<{ ok: true; events: MobileCalendarEventDto[] } | MobileApiFailure> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const path = q.toString()
    ? `${MOBILE_API_PATHS.calendarEvents}?${q.toString()}`
    : MOBILE_API_PATHS.calendarEvents;
  const res = await mobileGet<CalendarEventsJson>(path);
  if (res.ok === false) return res;
  if (!isEventList(res.data.events)) {
    return { ok: false, status: 200, message: "Invalid calendar events response." };
  }
  return { ok: true as const, events: res.data.events };
}

export async function postMobileCalendarEvent(body: {
  lead_id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  timezone?: string | null;
  calendar_provider?: MobileCalendarProvider | null;
}): Promise<{ ok: true; event: MobileCalendarEventDto } | MobileApiFailure> {
  const res = await mobilePost<CalendarEventMutationJson>(MOBILE_API_PATHS.calendarEvents, {
    lead_id: body.lead_id,
    title: body.title,
    description: body.description ?? null,
    starts_at: body.starts_at,
    ends_at: body.ends_at ?? null,
    timezone: body.timezone ?? null,
    calendar_provider: body.calendar_provider ?? "local",
  });
  if (res.ok === false) return res;
  const ev = res.data.event;
  if (!ev || typeof ev.id !== "string") {
    return { ok: false, status: 200, message: "Invalid create event response." };
  }
  return { ok: true, event: ev };
}

export async function patchMobileCalendarEvent(
  eventId: string,
  patch: {
    status?: MobileCalendarEventStatus;
    title?: string;
    description?: string | null;
    starts_at?: string;
    ends_at?: string | null;
  }
): Promise<{ ok: true; event: MobileCalendarEventDto } | MobileApiFailure> {
  const res = await mobilePatch<CalendarEventMutationJson>(
    MOBILE_API_PATHS.calendarEvent(eventId),
    patch as Record<string, unknown>
  );
  if (res.ok === false) return res;
  const ev = res.data.event;
  if (!ev || typeof ev.id !== "string") {
    return { ok: false, status: 200, message: "Invalid update event response." };
  }
  return { ok: true, event: ev };
}

export async function postMobileBookingLink(params: {
  lead_id: string;
  booking_url: string;
  label?: string | null;
  share_message?: string | null;
  expires_at?: string | null;
}): Promise<{ ok: true; booking_link: MobileBookingLinkDto } | MobileApiFailure> {
  const res = await mobilePost<BookingLinkJson>(MOBILE_API_PATHS.calendarBookingLink, {
    lead_id: params.lead_id,
    booking_url: params.booking_url,
    label: params.label ?? null,
    share_message: params.share_message ?? null,
    expires_at: params.expires_at ?? null,
  });
  if (res.ok === false) return res;
  const link = res.data.booking_link;
  if (!link || typeof link.id !== "string") {
    return { ok: false, status: 200, message: "Invalid booking link response." };
  }
  return { ok: true, booking_link: link };
}

export async function fetchMobileReminders(): Promise<
  ({ ok: true } & MobileRemindersResponseDto) | MobileApiFailure
> {
  const res = await mobileGet<RemindersJson>(MOBILE_API_PATHS.reminders);
  if (res.ok === false) return res;
  const d = res.data;
  if (
    !isEventList(d.upcoming_appointments) ||
    !isTaskList(d.overdue_tasks) ||
    !Array.isArray(d.follow_ups)
  ) {
    return { ok: false, status: 200, message: "Invalid reminders response." };
  }
  return {
    ok: true as const,
    upcoming_appointments: d.upcoming_appointments,
    overdue_tasks: d.overdue_tasks,
    follow_ups: d.follow_ups as MobileFollowUpReminderDto[],
  };
}

type NotificationsListJson = MobileJsonError & Partial<MobileNotificationsListResponseDto>;

export async function fetchMobileNotifications(params?: {
  limit?: number;
}): Promise<({ ok: true } & MobileNotificationsListResponseDto) | MobileApiFailure> {
  const q =
    typeof params?.limit === "number"
      ? `?limit=${encodeURIComponent(String(params.limit))}`
      : "";
  const res = await mobileGet<NotificationsListJson>(`${MOBILE_API_PATHS.notifications}${q}`);
  if (res.ok === false) return res;
  const list = res.data.notifications;
  if (!Array.isArray(list)) {
    return { ok: false, status: 200, message: "Invalid notifications response." };
  }
  return { ok: true, notifications: list as MobileAgentInboxNotificationDto[] };
}

export async function postMobileNotificationRead(params: {
  notificationId?: string;
  markAllRead?: boolean;
}): Promise<{ ok: true } | MobileApiFailure> {
  const body: Record<string, unknown> = {};
  if (params.markAllRead) body.markAllRead = true;
  else if (params.notificationId) body.notificationId = params.notificationId;
  else return { ok: false, status: 0, message: "notificationId or markAllRead required." };

  const res = await mobilePost<MobileJsonError>(MOBILE_API_PATHS.notifications, body);
  if (res.ok === false) return res;
  return { ok: true };
}

type PrefsJson = MobileJsonError & { preferences?: MobileNotificationPreferencesDto };

export async function fetchMobileNotificationPreferences(): Promise<
  ({ ok: true } & { preferences: MobileNotificationPreferencesDto }) | MobileApiFailure
> {
  const res = await mobileGet<PrefsJson>(MOBILE_API_PATHS.notificationPreferences);
  if (res.ok === false) return res;
  const p = res.data.preferences;
  if (!p || typeof p.push_hot_lead !== "boolean") {
    return { ok: false, status: 200, message: "Invalid notification preferences response." };
  }
  return { ok: true, preferences: p };
}

export async function patchMobileNotificationPreferences(
  patch: Partial<
    Pick<
      MobileNotificationPreferencesDto,
      "push_hot_lead" | "push_missed_call" | "push_reminder" | "reminder_digest_minutes"
    >
  >
): Promise<({ ok: true } & { preferences: MobileNotificationPreferencesDto }) | MobileApiFailure> {
  const res = await mobilePatch<PrefsJson>(MOBILE_API_PATHS.notificationPreferences, patch);
  if (res.ok === false) return res;
  const p = res.data.preferences;
  if (!p) {
    return { ok: false, status: 200, message: "Invalid notification preferences response." };
  }
  return { ok: true, preferences: p };
}
