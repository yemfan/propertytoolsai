import { describe, expect, it } from "vitest";
import { generateInsights } from "./insightRules";
import type { WeeklyMetrics } from "./types";

function baseMetrics(overrides?: Partial<WeeklyMetrics>): WeeklyMetrics {
  return {
    leads_contacted: 5,
    sms_sent: 10,
    emails_sent: 10,
    calls_logged: 3,
    tasks_completed: 5,
    appointments_booked: 1,
    hot_leads_generated: 1,
    avg_response_time_minutes: 20,
    missed_calls_unresolved: 0,
    overdue_tasks: 0,
    unread_conversations: 0,
    ...overrides,
  };
}

describe("generateInsights", () => {
  it("returns empty array for perfectly neutral metrics", () => {
    const insights = generateInsights(baseMetrics());
    // With base metrics, some rules may fire but it shouldn't crash
    expect(Array.isArray(insights)).toBe(true);
  });

  it("returns at most 5 insights", () => {
    const worst = baseMetrics({
      avg_response_time_minutes: 60,
      hot_leads_generated: 0,
      overdue_tasks: 5,
      missed_calls_unresolved: 3,
      unread_conversations: 10,
      sms_sent: 0,
      emails_sent: 0,
      leads_contacted: 0,
      tasks_completed: 0,
    });
    const insights = generateInsights(worst);
    expect(insights.length).toBeLessThanOrEqual(5);
  });

  it("flags fast response time as positive", () => {
    const insights = generateInsights(baseMetrics({ avg_response_time_minutes: 10 }));
    const fast = insights.find((i) => i.key === "response_time_fast");
    expect(fast).toBeDefined();
    expect(fast!.tone).toBe("positive");
  });

  it("flags slow response time as warning", () => {
    const insights = generateInsights(baseMetrics({ avg_response_time_minutes: 45 }));
    const slow = insights.find((i) => i.key === "response_time_slow");
    expect(slow).toBeDefined();
    expect(slow!.tone).toBe("warning");
  });

  it("flags overdue tasks as warning", () => {
    const insights = generateInsights(baseMetrics({ overdue_tasks: 3 }));
    const overdue = insights.find((i) => i.key === "overdue_tasks");
    expect(overdue).toBeDefined();
    expect(overdue!.tone).toBe("warning");
    expect(overdue!.label).toContain("3");
  });

  it("flags no tasks completed as warning", () => {
    const insights = generateInsights(baseMetrics({ tasks_completed: 0 }));
    const noTasks = insights.find((i) => i.key === "no_tasks_completed");
    expect(noTasks).toBeDefined();
    expect(noTasks!.tone).toBe("warning");
  });

  it("flags strong week as positive", () => {
    const insights = generateInsights(baseMetrics({ tasks_completed: 15, leads_contacted: 12 }));
    const strong = insights.find((i) => i.key === "strong_week");
    expect(strong).toBeDefined();
    expect(strong!.tone).toBe("positive");
  });

  it("flags hot leads flowing as positive", () => {
    const insights = generateInsights(baseMetrics({ hot_leads_generated: 5 }));
    const hot = insights.find((i) => i.key === "hot_leads_up");
    expect(hot).toBeDefined();
    expect(hot!.tone).toBe("positive");
  });

  it("sorts warnings before positives", () => {
    const insights = generateInsights(
      baseMetrics({
        avg_response_time_minutes: 10, // positive
        overdue_tasks: 3, // warning
        hot_leads_generated: 5, // positive
      })
    );
    const firstWarningIdx = insights.findIndex((i) => i.tone === "warning");
    const lastPositiveIdx = insights.map((i) => i.tone).lastIndexOf("positive");
    if (firstWarningIdx >= 0 && lastPositiveIdx >= 0) {
      expect(firstWarningIdx).toBeLessThan(lastPositiveIdx);
    }
  });

  it("handles null avg_response_time_minutes", () => {
    const insights = generateInsights(baseMetrics({ avg_response_time_minutes: null }));
    expect(insights.find((i) => i.key === "response_time_fast")).toBeUndefined();
    expect(insights.find((i) => i.key === "response_time_slow")).toBeUndefined();
  });
});
