import { redirect } from "next/navigation";

/** Legacy URL — send users to the public home. */
export default function PortalRedirectPage() {
  redirect("/");
}
