// Phone-number normalization moved to the shared @repo/voice package (used by
// every app that runs the voice agent). Re-exported here so existing
// `@/lib/phone` imports keep working.
export * from "@repo/voice/phone";
