import Papa from "papaparse";

export function rowsToCsv(rows: Record<string, unknown>[], columns?: readonly string[]): string {
  if (!rows.length) return "";
  const cols = columns?.length ? [...columns] : Object.keys(rows[0]).sort();
  return Papa.unparse(rows, { columns: cols, header: true });
}
