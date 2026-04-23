import type { PlaybookAnchor } from "./definitions";

export type PlaybookTaskRow = {
  id: string;
  agent_id: string;
  anchor_kind: PlaybookAnchor;
  anchor_id: string | null;
  template_key: string | null;
  apply_batch_id: string | null;
  title: string;
  notes: string | null;
  section: string | null;
  offset_days: number | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
