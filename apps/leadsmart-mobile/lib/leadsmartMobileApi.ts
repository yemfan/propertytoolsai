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

async function mobilePut<T extends MobileJsonError>(
  path: string,
  body: Record<string, unknown>
): Promise<MobileApiFailure | { ok: true; data: T }> {
  const cfg = requireConfig();
  if (!isMobileConfig(cfg)) return cfg;

  const { base, token } = cfg;
  const res = await apiFetchJson<T>(`${base}${path}`, body, {
    method: "PUT",
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

async function mobileDelete<T extends MobileJsonError>(
  path: string
): Promise<MobileApiFailure | { ok: true; data: T }> {
  const cfg = requireConfig();
  if (!isMobileConfig(cfg)) return cfg;

  const { base, token } = cfg;
  const res = await apiFetch<T>(`${base}${path}`, {
    method: "DELETE",
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

/**
 * Filter keys accepted by `/api/dashboard/leads`. Keep in sync with the
 * web handler at `apps/leadsmartai/app/api/dashboard/leads/route.ts` —
 * the server branches on each of these values, so widening the union
 * here without adding a branch there will silently return the default
 * list. `high_engagement` was previously missing from this type even
 * though the server and the mobile leads screen already supported it,
 * which caused a pre-existing TS error whenever the "Engaged" filter
 * chip was selected.
 */
export type MobileLeadsFilter = "hot" | "inactive" | "high_engagement";

export async function fetchMobileLeads(params: {
  page?: number;
  pageSize?: number;
  filter?: MobileLeadsFilter;
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

// ── Lead Queue ──

type QueueLead = {
  id: string | number;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  created_at: string;
};

export async function fetchLeadQueue(): Promise<
  ({ ok: true } & { leads: QueueLead[]; total: number }) | MobileApiFailure
> {
  const res = await mobileGet<{ ok: boolean; leads: QueueLead[]; total: number }>(
    `${MOBILE_API_PATHS.leadQueue}?pageSize=30`
  );
  if (res.ok === false) return res;
  return { ok: true, leads: res.data.leads ?? [], total: res.data.total ?? 0 };
}

export async function claimQueueLead(
  leadId: string
): Promise<({ ok: true } & { leadId: string }) | MobileApiFailure> {
  const res = await mobilePost<{ ok: boolean; leadId?: string; error?: string }>(
    MOBILE_API_PATHS.leadQueueClaim,
    { leadId }
  );
  if (res.ok === false) return res;
  if (!res.data.ok) return { ok: false, status: 200, message: res.data.error ?? "Claim failed" };
  return { ok: true, leadId: String(res.data.leadId ?? leadId) };
}

// ── CMA ───────────────────────────────────────────────────────────
//
// Mobile mirror of /api/mobile/cma. The web flow doesn't persist
// CMA reports — each generation is a fresh computation against the
// property warehouse + comps. So this is a single POST + render
// surface, not a list/detail flow.

export type MobileCmaSubject = {
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  propertyType: string | null;
  yearBuilt: number;
  condition: string;
};

export type MobileCmaComp = {
  address: string;
  price: number;
  sqft: number;
  beds: number | null;
  baths: number | null;
  distanceMiles: number;
  soldDate: string;
  propertyType: string | null;
  pricePerSqft: number;
};

export type MobileCmaStrategies = {
  aggressive: number;
  market: number;
  premium: number;
  daysOnMarket: { aggressive: number; market: number; premium: number };
};

export type MobileCmaReport = {
  summary: string;
  subject: MobileCmaSubject;
  comps: MobileCmaComp[];
  avgPricePerSqft: number;
  estimatedValue: number;
  low: number;
  high: number;
  strategies: MobileCmaStrategies;
};

type CmaJson = MobileJsonError &
  Partial<MobileCmaReport> & {
    usage?: { reached?: boolean; remaining?: number; limit?: number };
  };

export async function generateMobileCma(input: {
  address: string;
  sqft?: number | null;
  condition?: string | null;
}): Promise<({ ok: true } & MobileCmaReport) | MobileApiFailure> {
  const res = await mobilePost<CmaJson>(MOBILE_API_PATHS.cma, {
    address: input.address,
    sqft: input.sqft ?? undefined,
    condition: input.condition ?? undefined,
  });
  if (res.ok === false) return res;
  const d = res.data;
  if (!d.subject || !Array.isArray(d.comps)) {
    return { ok: false, status: 200, message: "Invalid CMA response." };
  }
  return {
    ok: true,
    summary: d.summary ?? "",
    subject: d.subject,
    comps: d.comps,
    avgPricePerSqft: Number(d.avgPricePerSqft ?? 0),
    estimatedValue: Number(d.estimatedValue ?? 0),
    low: Number(d.low ?? 0),
    high: Number(d.high ?? 0),
    strategies: d.strategies ?? {
      aggressive: 0,
      market: 0,
      premium: 0,
      daysOnMarket: { aggressive: 0, market: 0, premium: 0 },
    },
  };
}

// ── Postcards ─────────────────────────────────────────────────────
//
// Mobile mirrors of /api/mobile/postcards/*. Wire shape declared
// inline; keep in sync with apps/leadsmartai/lib/postcards/types.ts.

export type MobilePostcardTemplateKey =
  | "birthday"
  | "anniversary"
  | "holiday_seasonal"
  | "thinking_of_you";

export type MobilePostcardChannel = "email" | "sms" | "wechat";

export type MobilePostcardTemplate = {
  key: MobilePostcardTemplateKey;
  title: string;
  tagline: string;
  suggestedWhen: string;
  defaultMessage: string;
  accentColor: string;
  emojiBadge: string;
};

export type MobilePostcardSend = {
  id: string;
  agent_id: string;
  contact_id: string | null;
  template_key: MobilePostcardTemplateKey;
  slug: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  personal_message: string | null;
  channels: string[];
  email_sent_at: string | null;
  sms_sent_at: string | null;
  wechat_sent_at: string | null;
  email_error: string | null;
  sms_error: string | null;
  wechat_error: string | null;
  opened_at: string | null;
  open_count: number;
  created_at: string;
  updated_at: string;
};

type PostcardTemplatesJson = MobileJsonError & {
  templates?: MobilePostcardTemplate[];
};
type PostcardsListJson = MobileJsonError & {
  postcards?: MobilePostcardSend[];
};
type PostcardSendJson = MobileJsonError & {
  send?: MobilePostcardSend;
  publicUrl?: string;
  deliveries?: Record<string, { ok: boolean; reason?: string }>;
};

export async function fetchMobilePostcardTemplates(): Promise<
  ({ ok: true } & { templates: MobilePostcardTemplate[] }) | MobileApiFailure
> {
  const res = await mobileGet<PostcardTemplatesJson>(
    MOBILE_API_PATHS.postcardTemplates,
  );
  if (res.ok === false) return res;
  return { ok: true, templates: res.data.templates ?? [] };
}

export async function fetchMobilePostcards(opts?: {
  contactId?: string;
  limit?: number;
}): Promise<({ ok: true } & { postcards: MobilePostcardSend[] }) | MobileApiFailure> {
  const q = new URLSearchParams();
  if (opts?.contactId) q.set("contactId", opts.contactId);
  if (opts?.limit) q.set("limit", String(opts.limit));
  const path = q.toString()
    ? `${MOBILE_API_PATHS.postcards}?${q.toString()}`
    : MOBILE_API_PATHS.postcards;
  const res = await mobileGet<PostcardsListJson>(path);
  if (res.ok === false) return res;
  return { ok: true, postcards: res.data.postcards ?? [] };
}

export type MobileSendPostcardInput = {
  templateKey: MobilePostcardTemplateKey;
  recipientName: string;
  channels: MobilePostcardChannel[];
  contactId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  personalMessage?: string | null;
};

export async function sendMobilePostcard(
  input: MobileSendPostcardInput,
): Promise<
  | ({ ok: true } & {
      send: MobilePostcardSend;
      publicUrl: string;
      deliveries: Record<string, { ok: boolean; reason?: string }>;
    })
  | MobileApiFailure
> {
  const res = await mobilePost<PostcardSendJson>(
    MOBILE_API_PATHS.postcards,
    input as unknown as Record<string, unknown>,
  );
  if (res.ok === false) return res;
  if (!res.data.send) {
    return { ok: false, status: 500, message: "Postcard send returned no row" };
  }
  return {
    ok: true,
    send: res.data.send,
    publicUrl: res.data.publicUrl ?? "",
    deliveries: res.data.deliveries ?? {},
  };
}

// ── Showings ──────────────────────────────────────────────────────
//
// Mobile mirrors of /api/mobile/showings/*. The shared packages don't
// have showings DTOs yet, so we declare the wire shape inline here —
// mirrors lib/showings/types.ts on the dashboard. When the shared
// package gets a `MobileShowingDto`, replace these with imports.

export type MobileShowingStatus = "scheduled" | "attended" | "cancelled" | "no_show";
export type MobileShowingReaction = "love" | "like" | "maybe" | "pass";

export type MobileShowingListItem = {
  id: string;
  agent_id: string;
  contact_id: string;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  scheduled_at: string;
  status: MobileShowingStatus;
  access_notes: string | null;
  notes: string | null;
  contact_name: string | null;
  feedback_rating: number | null;
  feedback_reaction: MobileShowingReaction | null;
  feedback_would_offer: boolean | null;
  created_at: string;
  updated_at: string;
};

export type MobileShowingFeedback = {
  id: string;
  showing_id: string;
  rating: number | null;
  overall_reaction: MobileShowingReaction | null;
  would_offer: boolean | null;
  price_concerns: boolean | null;
  location_concerns: boolean | null;
  condition_concerns: boolean | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MobileShowingDetail = {
  showing: MobileShowingListItem;
  feedback: MobileShowingFeedback | null;
  contactName: string | null;
};

export async function fetchMobileShowings(opts?: {
  contactId?: string;
}): Promise<({ ok: true } & { showings: MobileShowingListItem[] }) | MobileApiFailure> {
  const path = opts?.contactId
    ? `${MOBILE_API_PATHS.showings}?contactId=${encodeURIComponent(opts.contactId)}`
    : MOBILE_API_PATHS.showings;
  const res = await mobileGet<{ showings?: MobileShowingListItem[] }>(path);
  if (res.ok === false) return res;
  return { ok: true, showings: res.data.showings ?? [] };
}

export async function fetchMobileShowingDetail(
  id: string,
): Promise<({ ok: true } & MobileShowingDetail) | MobileApiFailure> {
  const res = await mobileGet<{
    showing?: MobileShowingListItem;
    feedback?: MobileShowingFeedback | null;
    contactName?: string | null;
  }>(MOBILE_API_PATHS.showing(id));
  if (res.ok === false) return res;
  if (!res.data.showing) {
    return { ok: false, status: 404, message: "Showing not found" };
  }
  return {
    ok: true,
    showing: res.data.showing,
    feedback: res.data.feedback ?? null,
    contactName: res.data.contactName ?? null,
  };
}

export async function updateMobileShowingStatus(
  id: string,
  status: MobileShowingStatus,
): Promise<({ ok: true } & { showing: MobileShowingListItem }) | MobileApiFailure> {
  const res = await mobilePatch<{ showing?: MobileShowingListItem }>(
    MOBILE_API_PATHS.showing(id),
    { status },
  );
  if (res.ok === false) return res;
  if (!res.data.showing) {
    return { ok: false, status: 500, message: "Update returned no row" };
  }
  return { ok: true, showing: res.data.showing };
}

export type MobileShowingFeedbackInput = Partial<{
  rating: number;
  overall_reaction: MobileShowingReaction;
  would_offer: boolean;
  price_concerns: boolean;
  location_concerns: boolean;
  condition_concerns: boolean;
  pros: string;
  cons: string;
  notes: string;
}>;

export async function upsertMobileShowingFeedback(
  showingId: string,
  input: MobileShowingFeedbackInput,
): Promise<({ ok: true } & { feedback: MobileShowingFeedback }) | MobileApiFailure> {
  const res = await mobilePut<{ feedback?: MobileShowingFeedback }>(
    MOBILE_API_PATHS.showingFeedback(showingId),
    input as Record<string, unknown>,
  );
  if (res.ok === false) return res;
  if (!res.data.feedback) {
    return { ok: false, status: 500, message: "Feedback save returned no row" };
  }
  return { ok: true, feedback: res.data.feedback };
}

// ── Offers ────────────────────────────────────────────────────────
//
// Mobile mirrors of /api/mobile/offers/*. Like the showings types,
// these declare the wire shape inline because @leadsmart/shared
// doesn't have offer DTOs yet — keep in sync with
// apps/leadsmartai/lib/offers/types.ts.

export type MobileOfferStatus =
  | "draft"
  | "submitted"
  | "countered"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export type MobileFinancingType =
  | "cash"
  | "conventional"
  | "fha"
  | "va"
  | "jumbo"
  | "other";

export type MobileCounterDirection = "seller_to_buyer" | "buyer_to_seller";

export type MobileOfferRow = {
  id: string;
  agent_id: string;
  contact_id: string;
  showing_id: string | null;
  transaction_id: string | null;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  mls_url: string | null;
  list_price: number | null;
  offer_price: number;
  earnest_money: number | null;
  down_payment: number | null;
  financing_type: MobileFinancingType | null;
  closing_date_proposed: string | null;
  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  loan_contingency: boolean;
  contingency_notes: string | null;
  status: MobileOfferStatus;
  current_price: number | null;
  offer_expires_at: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MobileOfferListItem = MobileOfferRow & {
  contact_name: string | null;
  counter_count: number;
};

export type MobileOfferCounterRow = {
  id: string;
  offer_id: string;
  counter_number: number;
  direction: MobileCounterDirection;
  price: number | null;
  changed_fields: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

export type MobileOfferDetail = {
  offer: MobileOfferRow;
  counters: MobileOfferCounterRow[];
  contactName: string | null;
};

export type MobileOfferStatusFilter =
  | MobileOfferStatus
  | "active"
  | "won"
  | "lost"
  | "all";

export async function fetchMobileOffers(opts?: {
  contactId?: string;
  status?: MobileOfferStatusFilter;
}): Promise<({ ok: true } & { offers: MobileOfferListItem[] }) | MobileApiFailure> {
  const q = new URLSearchParams();
  if (opts?.contactId) q.set("contactId", opts.contactId);
  if (opts?.status) q.set("status", opts.status);
  const path = q.toString()
    ? `${MOBILE_API_PATHS.offers}?${q.toString()}`
    : MOBILE_API_PATHS.offers;
  const res = await mobileGet<{ offers?: MobileOfferListItem[] }>(path);
  if (res.ok === false) return res;
  return { ok: true, offers: res.data.offers ?? [] };
}

export async function fetchMobileOfferDetail(
  id: string,
): Promise<({ ok: true } & MobileOfferDetail) | MobileApiFailure> {
  const res = await mobileGet<{
    offer?: MobileOfferRow;
    counters?: MobileOfferCounterRow[];
    contactName?: string | null;
  }>(MOBILE_API_PATHS.offer(id));
  if (res.ok === false) return res;
  if (!res.data.offer) {
    return { ok: false, status: 404, message: "Offer not found" };
  }
  return {
    ok: true,
    offer: res.data.offer,
    counters: res.data.counters ?? [],
    contactName: res.data.contactName ?? null,
  };
}

export type MobileCreateOfferInput = {
  contactId: string;
  propertyAddress: string;
  offerPrice: number;
  showingId?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  mlsNumber?: string | null;
  listPrice?: number | null;
  earnestMoney?: number | null;
  downPayment?: number | null;
  financingType?: MobileFinancingType | null;
  closingDateProposed?: string | null;
  inspectionContingency?: boolean;
  appraisalContingency?: boolean;
  loanContingency?: boolean;
  contingencyNotes?: string | null;
  offerExpiresAt?: string | null;
  notes?: string | null;
  /** When true, the offer is created as `submitted` (stamps submitted_at). */
  submitNow?: boolean;
};

export async function createMobileOffer(
  input: MobileCreateOfferInput,
): Promise<({ ok: true } & { offer: MobileOfferRow }) | MobileApiFailure> {
  const res = await mobilePost<{ offer?: MobileOfferRow }>(
    MOBILE_API_PATHS.offers,
    input as unknown as Record<string, unknown>,
  );
  if (res.ok === false) return res;
  if (!res.data.offer) {
    return { ok: false, status: 500, message: "Create offer returned no row" };
  }
  return { ok: true, offer: res.data.offer };
}

export type MobileUpdateOfferInput = Partial<{
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  list_price: number | null;
  offer_price: number;
  earnest_money: number | null;
  down_payment: number | null;
  financing_type: MobileFinancingType | null;
  closing_date_proposed: string | null;
  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  loan_contingency: boolean;
  contingency_notes: string | null;
  status: MobileOfferStatus;
  current_price: number | null;
  offer_expires_at: string | null;
  notes: string | null;
}>;

export async function updateMobileOffer(
  id: string,
  patch: MobileUpdateOfferInput,
): Promise<({ ok: true } & { offer: MobileOfferRow }) | MobileApiFailure> {
  const res = await mobilePatch<{ offer?: MobileOfferRow }>(
    MOBILE_API_PATHS.offer(id),
    patch as Record<string, unknown>,
  );
  if (res.ok === false) return res;
  if (!res.data.offer) {
    return { ok: false, status: 500, message: "Update offer returned no row" };
  }
  return { ok: true, offer: res.data.offer };
}

export async function addMobileOfferCounter(
  offerId: string,
  input: {
    direction: MobileCounterDirection;
    price?: number | null;
    notes?: string | null;
    changedFields?: Record<string, unknown> | null;
  },
): Promise<({ ok: true } & { counter: MobileOfferCounterRow }) | MobileApiFailure> {
  const res = await mobilePost<{ counter?: MobileOfferCounterRow }>(
    MOBILE_API_PATHS.offerCounters(offerId),
    {
      direction: input.direction,
      price: input.price ?? null,
      notes: input.notes ?? null,
      changedFields: input.changedFields ?? null,
    },
  );
  if (res.ok === false) return res;
  if (!res.data.counter) {
    return { ok: false, status: 500, message: "Counter save returned no row" };
  }
  return { ok: true, counter: res.data.counter };
}

export async function convertMobileOfferToTransaction(
  offerId: string,
  opts?: { mutualAcceptanceDate?: string | null },
): Promise<({ ok: true } & { transaction: { id: string } }) | MobileApiFailure> {
  const res = await mobilePost<{ transaction?: { id: string } }>(
    MOBILE_API_PATHS.offerConvert(offerId),
    { mutualAcceptanceDate: opts?.mutualAcceptanceDate ?? null },
  );
  if (res.ok === false) return res;
  if (!res.data.transaction || typeof res.data.transaction.id !== "string") {
    return { ok: false, status: 500, message: "Convert returned no transaction" };
  }
  return { ok: true, transaction: { id: res.data.transaction.id } };
}

// ── Transactions ──────────────────────────────────────────────────
//
// Mobile mirrors of /api/mobile/transactions/*. Wire shape declared
// inline; keep in sync with apps/leadsmartai/lib/transactions/types.ts.

export type MobileTransactionType = "buyer_rep" | "listing_rep" | "dual";
export type MobileTransactionStatus = "active" | "closed" | "terminated" | "pending";
export type MobileTransactionStage =
  | "contract"
  | "inspection"
  | "appraisal"
  | "loan"
  | "closing";
export type MobileTransactionTaskSource = "seed" | "custom";

export type MobileTransactionRow = {
  id: string;
  agent_id: string;
  contact_id: string;
  transaction_type: MobileTransactionType;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchase_price: number | null;
  status: MobileTransactionStatus;
  terminated_reason: string | null;
  listing_start_date: string | null;
  mutual_acceptance_date: string | null;
  inspection_deadline: string | null;
  inspection_completed_at: string | null;
  appraisal_deadline: string | null;
  appraisal_completed_at: string | null;
  loan_contingency_deadline: string | null;
  loan_contingency_removed_at: string | null;
  closing_date: string | null;
  closing_date_actual: string | null;
  commission_pct: number | null;
  gross_commission: number | null;
  brokerage_split_pct: number | null;
  referral_fee_pct: number | null;
  agent_net_commission: number | null;
  seller_update_enabled: boolean;
  seller_update_last_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MobileTransactionTaskRow = {
  id: string;
  transaction_id: string;
  stage: MobileTransactionStage;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  order_index: number;
  seed_key: string | null;
  source: MobileTransactionTaskSource;
  created_at: string;
  updated_at: string;
};

export type MobileTransactionCounterpartyRow = {
  id: string;
  transaction_id: string;
  role: "title" | "lender" | "inspector" | "insurance" | "co_agent" | "other";
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MobileTransactionListItem = MobileTransactionRow & {
  contact_name: string | null;
  task_total: number;
  task_completed: number;
  task_overdue: number;
};

export type MobileTransactionDetail = {
  transaction: MobileTransactionRow;
  tasks: MobileTransactionTaskRow[];
  counterparties: MobileTransactionCounterpartyRow[];
  contactName: string | null;
};

export async function fetchMobileTransactions(): Promise<
  ({ ok: true } & { transactions: MobileTransactionListItem[] }) | MobileApiFailure
> {
  const res = await mobileGet<{ transactions?: MobileTransactionListItem[] }>(
    MOBILE_API_PATHS.transactions,
  );
  if (res.ok === false) return res;
  return { ok: true, transactions: res.data.transactions ?? [] };
}

export async function fetchMobileTransactionDetail(
  id: string,
): Promise<({ ok: true } & MobileTransactionDetail) | MobileApiFailure> {
  const res = await mobileGet<{
    transaction?: MobileTransactionRow;
    tasks?: MobileTransactionTaskRow[];
    counterparties?: MobileTransactionCounterpartyRow[];
    contactName?: string | null;
  }>(MOBILE_API_PATHS.transaction(id));
  if (res.ok === false) return res;
  if (!res.data.transaction) {
    return { ok: false, status: 404, message: "Transaction not found" };
  }
  return {
    ok: true,
    transaction: res.data.transaction,
    tasks: res.data.tasks ?? [],
    counterparties: res.data.counterparties ?? [],
    contactName: res.data.contactName ?? null,
  };
}

export type MobileUpdateTransactionInput = Partial<{
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchase_price: number | null;
  status: MobileTransactionStatus;
  terminated_reason: string | null;
  listing_start_date: string | null;
  mutual_acceptance_date: string | null;
  inspection_deadline: string | null;
  inspection_completed_at: string | null;
  appraisal_deadline: string | null;
  appraisal_completed_at: string | null;
  loan_contingency_deadline: string | null;
  loan_contingency_removed_at: string | null;
  closing_date: string | null;
  closing_date_actual: string | null;
  notes: string | null;
  seller_update_enabled: boolean;
}>;

export async function updateMobileTransaction(
  id: string,
  patch: MobileUpdateTransactionInput,
): Promise<({ ok: true } & { transaction: MobileTransactionRow }) | MobileApiFailure> {
  const res = await mobilePatch<{ transaction?: MobileTransactionRow }>(
    MOBILE_API_PATHS.transaction(id),
    patch as Record<string, unknown>,
  );
  if (res.ok === false) return res;
  if (!res.data.transaction) {
    return { ok: false, status: 500, message: "Update returned no row" };
  }
  return { ok: true, transaction: res.data.transaction };
}

export async function addMobileTransactionTask(
  transactionId: string,
  input: {
    stage: MobileTransactionStage;
    title: string;
    description?: string | null;
    due_date?: string | null;
  },
): Promise<({ ok: true } & { task: MobileTransactionTaskRow }) | MobileApiFailure> {
  const res = await mobilePost<{ task?: MobileTransactionTaskRow }>(
    MOBILE_API_PATHS.transactionTasks(transactionId),
    {
      stage: input.stage,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
    },
  );
  if (res.ok === false) return res;
  if (!res.data.task) {
    return { ok: false, status: 500, message: "Task create returned no row" };
  }
  return { ok: true, task: res.data.task };
}

export async function updateMobileTransactionTask(
  transactionId: string,
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    due_date: string | null;
    completed: boolean;
    stage: MobileTransactionStage;
  }>,
): Promise<({ ok: true } & { task: MobileTransactionTaskRow }) | MobileApiFailure> {
  const res = await mobilePatch<{ task?: MobileTransactionTaskRow }>(
    MOBILE_API_PATHS.transactionTask(transactionId, taskId),
    patch as Record<string, unknown>,
  );
  if (res.ok === false) return res;
  if (!res.data.task) {
    return { ok: false, status: 500, message: "Task update returned no row" };
  }
  return { ok: true, task: res.data.task };
}

export async function deleteMobileTransactionTask(
  transactionId: string,
  taskId: string,
): Promise<{ ok: true } | MobileApiFailure> {
  const res = await mobileDelete<MobileJsonError>(
    MOBILE_API_PATHS.transactionTask(transactionId, taskId),
  );
  if (res.ok === false) return res;
  return { ok: true };
}
