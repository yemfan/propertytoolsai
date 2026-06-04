import { redirect } from "next/navigation";

/**
 * The missed-call text-back now lives inside the AI Receptionist (inbound) page,
 * alongside live call answering. This route redirects so any old links still land.
 */
export default function ReceptionPage() {
  redirect("/voice");
}
