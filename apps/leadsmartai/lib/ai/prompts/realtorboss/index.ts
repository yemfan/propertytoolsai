/**
 * RealtorBoss prompt library — system prompts + skill fragments for
 * the four-member AI real estate team.
 *
 *   Boss Assistant          — AI Chief of Staff (briefings, priorities)
 *   AI Receptionist         — inbound calls ("never miss a call")
 *   AI Sales Assistant      — outbound conversion ("never miss a lead")
 *   AI Transaction Assistant— deal coordination ("never miss a deadline")
 */
export { SHARED_GUARDRAILS, withGuardrails } from "./shared-guardrails";
export {
  BOSS_ASSISTANT_SYSTEM_PROMPT,
  bossBriefingPrompt,
  type BossBriefingSignals,
} from "./boss-assistant";
export { RECEPTIONIST_SYSTEM_PROMPT } from "./receptionist";
export { SALES_ASSISTANT_SYSTEM_PROMPT } from "./sales-assistant";
export { TRANSACTION_ASSISTANT_SYSTEM_PROMPT } from "./transaction-assistant";
export { SKILLS, getSkill, skillPrompts, type Skill, type SkillCategory } from "./skills";
