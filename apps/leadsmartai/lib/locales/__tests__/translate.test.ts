import { describe, expect, it, vi } from "vitest";
import { hashText, translateText, type TranslationDeps } from "../translate";

function makeDeps(overrides: Partial<TranslationDeps> = {}): TranslationDeps {
  return {
    lookup: vi.fn().mockResolvedValue(null),
    store: vi.fn().mockResolvedValue(undefined),
    generate: vi.fn().mockResolvedValue("TRANSLATED"),
    ...overrides,
  };
}

describe("translateText", () => {
  it("returns the identity translation when source === target (no network)", async () => {
    const deps = makeDeps();
    const out = await translateText("hello", {
      targetLocale: "en",
      sourceLocale: "en",
      deps,
    });
    expect(out).toBe("hello");
    expect(deps.lookup).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("trims input and returns '' for whitespace-only strings", async () => {
    const deps = makeDeps();
    const out = await translateText("   \n\t", {
      targetLocale: "zh",
      sourceLocale: "en",
      deps,
    });
    expect(out).toBe("");
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("returns the cached translation when the lookup finds a hit", async () => {
    const deps = makeDeps({
      lookup: vi.fn().mockResolvedValue({
        text_hash: hashText("hello"),
        source_locale: "en",
        target_locale: "zh",
        translated_text: "你好",
        created_at: "2026-04-21T00:00:00Z",
      }),
    });
    const out = await translateText("hello", {
      targetLocale: "zh",
      sourceLocale: "en",
      deps,
    });
    expect(out).toBe("你好");
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.store).not.toHaveBeenCalled();
  });

  it("generates + stores on cache miss, keyed by hash", async () => {
    const deps = makeDeps({
      generate: vi.fn().mockResolvedValue("你好"),
    });
    const out = await translateText("hello", {
      targetLocale: "zh",
      sourceLocale: "en",
      deps,
    });
    expect(out).toBe("你好");
    expect(deps.generate).toHaveBeenCalledWith({
      text: "hello",
      sourceLocale: "en",
      targetLocale: "zh",
    });
    expect(deps.store).toHaveBeenCalledWith({
      text_hash: hashText("hello"),
      source_locale: "en",
      target_locale: "zh",
      translated_text: "你好",
    });
  });

  it("passes sourceLocale=null to the generator when caller omits it", async () => {
    const deps = makeDeps({
      generate: vi.fn().mockResolvedValue("Hola"),
    });
    await translateText("hello", {
      targetLocale: "en",
      sourceLocale: null,
      deps,
    });
    const call = (deps.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.sourceLocale).toBeNull();
  });

  it("coerces unknown source/target locales through the registry", async () => {
    const deps = makeDeps({
      // Unknown target coerces to 'en', same as source 'en' → identity → no gen.
      lookup: vi.fn().mockResolvedValue(null),
    });
    const out = await translateText("hello", {
      // @ts-expect-error — intentionally invalid to exercise coerce path
      targetLocale: "klingon",
      sourceLocale: "en",
      deps,
    });
    expect(out).toBe("hello");
    expect(deps.generate).not.toHaveBeenCalled();
  });
});
