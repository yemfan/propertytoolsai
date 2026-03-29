import type { MobileLeadRecordDto } from "@leadsmart/shared";

/** Read a string field from a mobile lead row (Supabase may send extra keys). */
export function leadField(row: MobileLeadRecordDto, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}
