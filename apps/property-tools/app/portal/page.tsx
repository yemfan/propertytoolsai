import { redirect } from "next/navigation";

/** Legacy URL — the app uses `/dashboard`; nothing should link here. */
export default function PortalRedirectPage() {
  redirect("/dashboard");
}
