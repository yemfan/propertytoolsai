export type ToolName =
  | "estimator"
  | "rental_analyzer"
  | "cma"
  | "presentation"
  | "comparison_report";

export const TOOL_TOKEN_COST: Record<ToolName, number> = {
  estimator: 1,
  rental_analyzer: 2,
  cma: 5,
  presentation: 8,
  comparison_report: 6,
};

