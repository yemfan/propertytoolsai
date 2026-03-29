export function normalizeCompetitorDomain(input: string): string {
  let s = String(input ?? "").trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split("/")[0] ?? s;
  s = s.split(":")[0] ?? s;
  return s.replace(/\.+$/, "");
}

export function originFromDomain(domain: string): string {
  const d = normalizeCompetitorDomain(domain);
  return `https://${d}`;
}
