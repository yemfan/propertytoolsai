/**
 * Tests for the autonomy gating logic.
 *
 * We test the routing decisions in isolation by mocking the minimal Supabase
 * surface the gating module uses (just the db.from() calls for approval insert
 * and the @helm/ai-workforce functions). The real DB and real employee records
 * are not involved — we're testing the decision tree, not the infra.
 */
import { describe, it, expect, vi, type MockedFunction } from "vitest";

// ── Lightweight mock for @helm/ai-workforce ──────────────────────────────────

vi.mock("@helm/ai-workforce", () => ({
  getEmployee: vi.fn(),
  startRun: vi.fn().mockResolvedValue("run-123"),
  completeRun: vi.fn().mockResolvedValue(undefined),
  escalateRun: vi.fn().mockResolvedValue(undefined),
  failRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/actions/notifications", () => ({
  createNotificationService: vi.fn().mockResolvedValue(undefined),
}));

import {
  getEmployee,
  startRun,
  escalateRun,
  failRun,
  completeRun,
} from "@helm/ai-workforce";

import { enforceAutonomy } from "./workforce-gating";
import type { AiEmployee } from "@helm/ai-workforce";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(autonomy: "autonomous" | "act_with_approval" | "suggest"): AiEmployee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    slug: "emma",
    name: "Emma",
    role: "AI Receptionist",
    department: "Service",
    dnaModule: "service",
    industryPack: null,
    goals: [],
    knowledgeSources: [],
    permissions: { autonomy },
    model: "claude-sonnet-4-6",
    personality: "Warm",
    status: "active",
    config: {},
  };
}

function makeDb(insertResult: { error: null | { message: string } } = { error: null }) {
  const insertFn = vi.fn().mockResolvedValue(insertResult);
  return {
    from: vi.fn().mockReturnValue({ insert: insertFn }),
    _insertFn: insertFn,
  } as unknown as Parameters<typeof enforceAutonomy>[0];
}

const baseOpts = {
  runInput: { channel: "sms" as const, subjectType: "contact", subjectId: "client-1" },
  approvalSubject: { from: "+16265551234", bodyPreview: "I need an appointment" },
  toolKey: "service.book_appointment",
  toolInput: { from: "+16265551234" },
  description: "Emma wants to book an appointment",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("enforceAutonomy", () => {
  it("returns no_employee when getEmployee returns null", async () => {
    (getEmployee as MockedFunction<typeof getEmployee>).mockResolvedValueOnce(null);
    const execute = vi.fn();
    const result = await enforceAutonomy(makeDb(), "org-1", "emma", { ...baseOpts, execute });
    expect(result.status).toBe("no_employee");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns no_employee when employee is paused", async () => {
    (getEmployee as MockedFunction<typeof getEmployee>).mockResolvedValueOnce({
      ...makeEmployee("autonomous"),
      status: "paused",
    });
    const execute = vi.fn();
    const result = await enforceAutonomy(makeDb(), "org-1", "emma", { ...baseOpts, execute });
    expect(result.status).toBe("no_employee");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns skipped without calling execute for suggest", async () => {
    (getEmployee as MockedFunction<typeof getEmployee>).mockResolvedValueOnce(makeEmployee("suggest"));
    const execute = vi.fn();
    const result = await enforceAutonomy(makeDb(), "org-1", "emma", { ...baseOpts, execute });
    expect(result.status).toBe("skipped");
    expect(execute).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
  });

  it("escalates without calling execute for act_with_approval", async () => {
    (getEmployee as MockedFunction<typeof getEmployee>).mockResolvedValueOnce(makeEmployee("act_with_approval"));
    const execute = vi.fn();
    const db = makeDb();
    const result = await enforceAutonomy(db, "org-1", "emma", { ...baseOpts, execute });
    expect(result.status).toBe("escalated");
    expect(result.runId).toBe("run-123");
    expect(execute).not.toHaveBeenCalled();
    expect(escalateRun).toHaveBeenCalledWith(expect.anything(), "org-1", "run-123", expect.any(String));
    expect(db.from).toHaveBeenCalledWith("ai_employee_approvals");
  });

  it("calls execute and returns executed for autonomous", async () => {
    (getEmployee as MockedFunction<typeof getEmployee>).mockResolvedValueOnce(makeEmployee("autonomous"));
    (completeRun as MockedFunction<typeof completeRun>).mockResolvedValue(undefined);
    const execute = vi.fn().mockResolvedValue({ value: "booked", tokensUsed: 800, costCents: 1 });
    const result = await enforceAutonomy(makeDb(), "org-1", "emma", { ...baseOpts, execute });
    expect(result.status).toBe("executed");
    expect(result.value).toBe("booked");
    expect(execute).toHaveBeenCalledWith("run-123");
    expect(completeRun).toHaveBeenCalledWith(
      expect.anything(), "org-1", "run-123",
      expect.objectContaining({ status: "succeeded", tokensUsed: 800, costCents: 1 }),
    );
  });

  it("closes as failed (not throws) when execute throws", async () => {
    (getEmployee as MockedFunction<typeof getEmployee>).mockResolvedValueOnce(makeEmployee("autonomous"));
    (failRun as MockedFunction<typeof failRun>).mockResolvedValue(undefined);
    const execute = vi.fn().mockRejectedValue(new Error("Anthropic timeout"));
    const result = await enforceAutonomy(makeDb(), "org-1", "emma", { ...baseOpts, execute });
    expect(result.status).toBe("executed"); // attempted
    expect(failRun).toHaveBeenCalledWith(
      expect.anything(), "org-1", "run-123", "Anthropic timeout",
    );
  });
});
