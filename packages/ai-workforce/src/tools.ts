// Tool dispatch. An employee's "tools" are references to DNA-service capabilities —
// the runtime routes a tool key to a handler, but the HANDLER BODY is supplied by the
// app/composition layer (which imports the @helm/dna-* packages). This is what keeps
// ai-workforce from importing every DNA module and preserves "the employee holds no
// business logic": the registry maps keys → app-provided handlers.

import type { DnaModule } from "./types";
import type { Db } from "./db";

/** Ambient context handed to every tool handler during a run. */
export interface ToolContext {
  db: Db;
  orgId: string;
  employeeId: string;
  runId?: string;
}

/** Performs one DNA-service capability. Supplied by the app; the runtime only routes to it. */
export type ToolHandler<I = unknown, O = unknown> = (input: I, ctx: ToolContext) => Promise<O>;

/** A callable tool: a stable key, the DNA module it belongs to, and its handler. */
export interface RegisteredTool<I = unknown, O = unknown> {
  key: string; // 'finance.draft_invoice' | 'service.book_appointment' …
  dnaModule: DnaModule;
  handler: ToolHandler<I, O>;
}

export type ToolRegistry = ReadonlyMap<string, RegisteredTool>;

/** Build a registry from a list of tools (last definition wins on a duplicate key). */
export function createToolRegistry(tools: RegisteredTool[]): ToolRegistry {
  const map = new Map<string, RegisteredTool>();
  for (const t of tools) map.set(t.key, t);
  return map;
}

export class ToolNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`No tool registered for key "${key}"`);
    this.name = "ToolNotFoundError";
  }
}

/** Look up a tool by key and invoke it. Throws ToolNotFoundError if unregistered. */
export async function dispatchTool<O = unknown>(
  registry: ToolRegistry,
  key: string,
  input: unknown,
  ctx: ToolContext
): Promise<O> {
  const tool = registry.get(key);
  if (!tool) throw new ToolNotFoundError(key);
  return tool.handler(input, ctx) as Promise<O>;
}
