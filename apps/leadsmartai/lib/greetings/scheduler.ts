import { runGreetingAutomation } from "./service";

export async function runDailyGreetingsJob(agentId?: string) {
  return runGreetingAutomation(agentId);
}
