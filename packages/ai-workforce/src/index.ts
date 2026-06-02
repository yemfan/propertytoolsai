// @helm/ai-workforce — AI Workforce: first-class AI employees (Role/Goals/Tools/
// Knowledge/Permissions/Memory/Metrics). Domain model backed by 00048_ai_workforce.
// Runtime (registry queries, tool dispatch, run/metric recording) lands in a follow-up
// once @helm/data's generated types include the ai_employee_* tables.
//
// Core package: MUST NOT import @helm/pack-* or apps/*.
export * from "./types";
