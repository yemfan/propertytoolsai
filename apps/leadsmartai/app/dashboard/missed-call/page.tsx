import { redirect } from "next/navigation";

/**
 * The voice console merged into the one Receptionist page — calls,
 * text-backs, call-backs, settings, and outbound tools all live at
 * /dashboard/ai-receptionist now. Kept as a redirect for old links.
 */
export default function MissedCallPage() {
  redirect("/dashboard/ai-receptionist");
}
