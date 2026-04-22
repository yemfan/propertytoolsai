import { describe, expect, it, vi } from "vitest";
import { autoDetectContactLanguage } from "../autoDetectContactLanguage";

function makeSupabase(existing: { preferred_language: string | null } | null, opts?: {
  readError?: string;
  updateError?: string;
}) {
  const updateSpy = vi.fn().mockResolvedValue({
    error: opts?.updateError ? { message: opts.updateError } : null,
  });

  const fromSpy = vi.fn().mockImplementation((table: string) => {
    if (table !== "contacts") throw new Error(`unexpected table: ${table}`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: existing,
            error: opts?.readError ? { message: opts.readError } : null,
          }),
        }),
      }),
      update: () => ({
        eq: updateSpy,
      }),
    };
  });

  return { supabase: { from: fromSpy } as never, updateSpy };
}

describe("autoDetectContactLanguage", () => {
  it("sets preferred_language to 'zh' when inbound contains CJK and column is NULL", async () => {
    const { supabase, updateSpy } = makeSupabase({ preferred_language: null });
    const result = await autoDetectContactLanguage({
      supabase,
      contactId: "c1",
      inboundText: "您好，请问这套房子还在挂牌吗？",
    });
    expect(result).toEqual({ kind: "set", language: "zh" });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite an existing non-null preferred_language", async () => {
    const { supabase, updateSpy } = makeSupabase({ preferred_language: "en" });
    const result = await autoDetectContactLanguage({
      supabase,
      contactId: "c1",
      inboundText: "您好",
    });
    expect(result).toEqual({ kind: "already_set", existing: "en" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("does not write 'en' when detection says English (keeps NULL)", async () => {
    const { supabase, updateSpy } = makeSupabase({ preferred_language: null });
    const result = await autoDetectContactLanguage({
      supabase,
      contactId: "c1",
      inboundText: "Hi, is this still available?",
    });
    expect(result).toEqual({ kind: "no_change", detected: "en" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns error kind on DB read failure", async () => {
    const { supabase, updateSpy } = makeSupabase(null, { readError: "boom" });
    const result = await autoDetectContactLanguage({
      supabase,
      contactId: "c1",
      inboundText: "您好",
    });
    expect(result.kind).toBe("error");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns error kind on DB update failure (without throwing)", async () => {
    const { supabase } = makeSupabase(
      { preferred_language: null },
      { updateError: "constraint violation" },
    );
    const result = await autoDetectContactLanguage({
      supabase,
      contactId: "c1",
      inboundText: "您好",
    });
    expect(result.kind).toBe("error");
  });

  it("handles a completely missing contact (data is null) by treating existing as null + attempting write", async () => {
    const { supabase, updateSpy } = makeSupabase(null);
    const result = await autoDetectContactLanguage({
      supabase,
      contactId: "c1",
      inboundText: "你好",
    });
    expect(result.kind).toBe("set");
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
