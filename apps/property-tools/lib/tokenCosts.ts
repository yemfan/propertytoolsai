export type ToolName =
  | "estimator"
  | "rental_analyzer"
  | "cma"
  | "presentation";

export const TOOL_TOKEN_COST: Record<ToolName, number> = {
  estimator: 1,
  rental_analyzer: 2,
  cma: 5,
  presentation: 8,
};

