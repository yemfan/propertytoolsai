import { describe, expect, it } from "vitest";
import { canAcceptOneMoreSeat, computeSeatUsage } from "../seats";

describe("computeSeatUsage", () => {
  it("counts members + active invites against the cap", () => {
    const u = computeSeatUsage({
      memberCount: 3,
      activeInviteCount: 2,
      cap: 10,
    });
    expect(u.used).toBe(5);
    expect(u.cap).toBe(10);
    expect(u.available).toBe(5);
    expect(u.full).toBe(false);
  });

  it("flags full when used === cap", () => {
    const u = computeSeatUsage({
      memberCount: 5,
      activeInviteCount: 5,
      cap: 10,
    });
    expect(u.used).toBe(10);
    expect(u.available).toBe(0);
    expect(u.full).toBe(true);
  });

  it("flags full when used exceeds cap (post-downgrade scenario)", () => {
    const u = computeSeatUsage({
      memberCount: 8,
      activeInviteCount: 0,
      cap: 5,
    });
    expect(u.used).toBe(8);
    expect(u.available).toBe(0); // clamped at 0, not negative
    expect(u.full).toBe(true);
  });

  it("treats null cap as unlimited — never full", () => {
    const u = computeSeatUsage({
      memberCount: 9999,
      activeInviteCount: 0,
      cap: null,
    });
    expect(u.cap).toBeNull();
    expect(u.available).toBeNull();
    expect(u.full).toBe(false);
  });

  it("treats cap=0 as fully blocked even with no members", () => {
    const u = computeSeatUsage({
      memberCount: 0,
      activeInviteCount: 0,
      cap: 0,
    });
    expect(u.used).toBe(0);
    expect(u.full).toBe(true);
  });

  it("clamps negative input counts to zero defensively", () => {
    const u = computeSeatUsage({
      memberCount: -3,
      activeInviteCount: -1,
      cap: 10,
    });
    expect(u.used).toBe(0);
  });
});

describe("canAcceptOneMoreSeat", () => {
  it("allows when below cap", () => {
    expect(
      canAcceptOneMoreSeat({
        used: 5,
        cap: 10,
        available: 5,
        full: false,
      }),
    ).toBe(true);
  });

  it("rejects when at cap", () => {
    expect(
      canAcceptOneMoreSeat({
        used: 10,
        cap: 10,
        available: 0,
        full: true,
      }),
    ).toBe(false);
  });

  it("always allows when cap is null (unlimited)", () => {
    expect(
      canAcceptOneMoreSeat({
        used: 1000,
        cap: null,
        available: null,
        full: false,
      }),
    ).toBe(true);
  });
});
