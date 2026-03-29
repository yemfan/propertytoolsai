import type { ContactFieldsInput } from "./types";

/** Maps CRM field names to the CSV column header selected by the user. */
export type ColumnMapping = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  property_address?: string | null;
  notes?: string | null;
};

export function rowToContactFields(raw: Record<string, string>, mapping: ColumnMapping): ContactFieldsInput {
  const get = (key: string | null | undefined) => {
    if (!key) return "";
    return String(raw[key] ?? "").trim();
  };
  return {
    name: get(mapping.name) || null,
    email: get(mapping.email) || null,
    phone: get(mapping.phone) || null,
    property_address: get(mapping.property_address) || null,
    notes: get(mapping.notes) || null,
  };
}
