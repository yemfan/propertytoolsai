import { describe, expect, it } from "vitest";
import { PLAN_TEMPLATES } from "./templates";

describe("PLAN_TEMPLATES", () => {
  it("has at least 3 templates", () => {
    expect(PLAN_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it("all templates have unique keys", () => {
    const keys = PLAN_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every template has required fields", () => {
    for (const tmpl of PLAN_TEMPLATES) {
      expect(tmpl.key).toBeTruthy();
      expect(tmpl.title).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.trigger_type).toBeTruthy();
      expect(tmpl.steps.length).toBeGreaterThan(0);
    }
  });

  it("every step has valid channel and action", () => {
    const validChannels = ["sms", "email", "task", "notification"];
    const validActions = ["send_sms", "send_email", "create_task", "send_notification"];

    for (const tmpl of PLAN_TEMPLATES) {
      for (const step of tmpl.steps) {
        expect(validChannels).toContain(step.channel);
        expect(validActions).toContain(step.action);
        expect(step.body).toBeTruthy();
        expect(step.delay_days).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("step delays are in ascending order within each template", () => {
    for (const tmpl of PLAN_TEMPLATES) {
      for (let i = 1; i < tmpl.steps.length; i++) {
        expect(tmpl.steps[i].delay_days).toBeGreaterThanOrEqual(tmpl.steps[i - 1].delay_days);
      }
    }
  });

  it("email steps have a subject", () => {
    for (const tmpl of PLAN_TEMPLATES) {
      for (const step of tmpl.steps) {
        if (step.channel === "email") {
          expect(step.subject).toBeTruthy();
        }
      }
    }
  });

  it("includes buyer_nurture and seller_nurture templates", () => {
    const keys = PLAN_TEMPLATES.map((t) => t.key);
    expect(keys).toContain("buyer_nurture");
    expect(keys).toContain("seller_nurture");
  });
});
