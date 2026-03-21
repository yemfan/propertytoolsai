export function leadsmartLog(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, any>
) {
  const payload = {
    ts: new Date().toISOString(),
    scope: "leadsmart",
    level,
    message,
    ...(meta ?? {}),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}
