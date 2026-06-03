// The receptionist "brain" types + hours helpers moved to the shared @repo/voice
// package (used by every app that runs the voice agent). Re-exported here so
// existing `@/lib/receptionist` imports keep working unchanged.
export * from "@repo/voice/brain";
