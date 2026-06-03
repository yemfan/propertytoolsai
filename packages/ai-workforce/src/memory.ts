// Employee memory: what an employee remembers, as soft refs (subjectType/subjectId,
// no cross-DNA FK). Recall returns the most important + most recent first and never
// returns expired entries. (Vector recall is deferred to the Knowledge DNA migration.)

import type { AiEmployeeMemory, MemoryKind } from "./types";
import { type Db, rowToMemory } from "./db";

export interface RememberInput {
  employeeId: string;
  content: string;
  kind?: MemoryKind; // default 'episodic'
  subjectType?: string | null;
  subjectId?: string | null;
  importance?: number; // 0..n, higher recalled first
  expiresAt?: string | null; // ISO; null = never expires
}

/** Record a memory; returns its id. */
export async function rememberFact(db: Db, orgId: string, input: RememberInput): Promise<string> {
  const { data, error } = await db
    .from("ai_employee_memory")
    .insert({
      organization_id: orgId,
      employee_id: input.employeeId,
      content: input.content,
      kind: input.kind ?? "episodic",
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      importance: input.importance ?? 0,
      expires_at: input.expiresAt ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to record memory");
  return data.id;
}

export interface RecallQuery {
  subjectType?: string;
  subjectId?: string;
  kind?: MemoryKind;
  limit?: number; // default 20
}

/** Recall an employee's memories (importance desc, then recency), excluding expired. */
export async function recallMemories(
  db: Db,
  orgId: string,
  employeeId: string,
  q: RecallQuery = {}
): Promise<AiEmployeeMemory[]> {
  let query = db
    .from("ai_employee_memory")
    .select("*")
    .eq("organization_id", orgId)
    .eq("employee_id", employeeId);
  if (q.subjectType) query = query.eq("subject_type", q.subjectType);
  if (q.subjectId) query = query.eq("subject_id", q.subjectId);
  if (q.kind) query = query.eq("kind", q.kind);

  const { data, error } = await query
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(q.limit ?? 20);
  if (error) throw new Error(error.message);

  // Filter expired in-process so the unique millisecond timestamp never trips
  // PostgREST's dotted-value parsing in an .or() filter.
  const now = Date.now();
  return (data ?? [])
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
    .map(rowToMemory);
}
