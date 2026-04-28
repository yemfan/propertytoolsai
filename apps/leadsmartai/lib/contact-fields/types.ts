/**
 * Shared types for the contact-custom-fields layer.
 */

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiselect";

export type FieldOption = {
  value: string;
  label: string;
};

export type ContactFieldDef = {
  id: string;
  agentId: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  options: FieldOption[];
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Stored shape on contacts.custom_fields. Keys are field_key. */
export type CustomFieldValues = Record<string, FieldValue>;

/** Single-value union — what one cell can hold post-coercion. */
export type FieldValue =
  | string
  | number
  | boolean
  | string[]   // multiselect
  | null;
