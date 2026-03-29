import { runReengagementJob } from "./service";

export async function runDailyReengagement() {
  return runReengagementJob();
}
