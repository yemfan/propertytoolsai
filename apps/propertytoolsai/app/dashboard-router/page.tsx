import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard` — kept for bookmarks and older links. */
export default async function DashboardRouterPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const sp = searchParams != null ? await searchParams : {};
  const r = sp.redirect;
  const qs =
    typeof r === "string" && r.startsWith("/") && !r.startsWith("//")
      ? `?redirect=${encodeURIComponent(r)}`
      : "";
  redirect(`/dashboard${qs}`);
}
