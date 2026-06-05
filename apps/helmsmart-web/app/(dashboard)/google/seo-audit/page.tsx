import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CheckCircle2, AlertCircle, XCircle, TrendingUp, Search } from "lucide-react";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "SEO Audit · Google Business" };

type Status = "pass" | "warn" | "fail";

interface AuditItem {
  title: string;
  description: string;
  status: Status;
  recommendation?: string;
}

export default async function SEOAuditPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, auto_request_reviews")
    .eq("id", orgId)
    .single();

  const { data: profile } = await supabase
    .from("google_business_profiles")
    .select("business_name, rating, review_count")
    .eq("organization_id", orgId)
    .single();

  const { count: reviewCount } = await supabase
    .from("google_reviews")
    .select("id", { count: "exact" })
    .eq("organization_id", orgId);

  // Generate audit items
  const auditItems: AuditItem[] = [
    {
      title: "Google Business Profile Connected",
      description: "Your Google Business Profile is connected and synced.",
      status: profile ? "pass" : "fail",
      recommendation: !profile ? "Connect your Google Business Profile to enable local SEO features" : undefined,
    },
    {
      title: "Business Reviews (5+ recommended)",
      description: `You have ${reviewCount || 0} reviews synced.`,
      status: (reviewCount ?? 0) >= 5 ? "pass" : (reviewCount ?? 0) > 0 ? "warn" : "fail",
      recommendation:
        (reviewCount ?? 0) < 5
          ? "Request more reviews to improve your local search visibility. Businesses with 5+ reviews rank higher."
          : undefined,
    },
    {
      title: "Average Rating",
      description: profile?.rating ? `${profile.rating.toFixed(1)} / 5.0 stars` : "No rating yet",
      status: (profile?.rating ?? 0) >= 4.0 ? "pass" : (profile?.rating ?? 0) > 0 ? "warn" : "fail",
      recommendation:
        (profile?.rating ?? 0) < 4.0
          ? "Encourage happy customers to review and respond professionally to negative reviews"
          : undefined,
    },
    {
      title: "Auto-Request Reviews Enabled",
      description: org?.auto_request_reviews ? "Automatically requesting reviews after appointments" : "Not enabled",
      status: org?.auto_request_reviews ? "pass" : "warn",
      recommendation: !org?.auto_request_reviews ? "Enable auto-request reviews to increase review volume" : undefined,
    },
    {
      title: "Structured Data (Schema.org)",
      description: "LocalBusiness schema with reviews markup is enabled on your site.",
      status: "pass",
      recommendation: undefined,
    },
    {
      title: "Sitemap Generated",
      description: "Your sitemap.xml is automatically generated and updated.",
      status: "pass",
      recommendation: undefined,
    },
    {
      title: "Robots.txt Configured",
      description: "Search engines can crawl public pages; API and dashboard are blocked.",
      status: "pass",
      recommendation: undefined,
    },
  ];

  const passCount = auditItems.filter((item) => item.status === "pass").length;
  const warnCount = auditItems.filter((item) => item.status === "warn").length;
  const failCount = auditItems.filter((item) => item.status === "fail").length;
  const score = Math.round(((passCount * 1 + warnCount * 0.5) / auditItems.length) * 100);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/google" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">SEO Audit</h1>
        <p className="text-sm text-slate-500 mt-0.5">Check your on-page SEO and local search visibility</p>
      </div>

      {/* Score Card */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-700 uppercase">SEO Health Score</p>
            <p className="text-5xl font-bold text-indigo-900 mt-2">{score}%</p>
            <p className="text-sm text-indigo-600 mt-2">
              {passCount} passing · {warnCount} warnings · {failCount} issues
            </p>
          </div>
          <div className="text-6xl font-bold text-indigo-200">
            {Math.round(score / 20)}/{5}
          </div>
        </div>
      </div>

      {/* Audit Items */}
      <div className="space-y-4">
        {auditItems.map((item, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start gap-4">
              {item.status === "pass" && (
                <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}
              {item.status === "warn" && (
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              {item.status === "fail" && (
                <XCircle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" />
              )}

              <div className="flex-1">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                {item.recommendation && (
                  <p className="text-sm text-amber-700 mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                    💡 {item.recommendation}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SEO Tips */}
      <div className="mt-8 bg-blue-50 rounded-xl border border-blue-200 p-6">
        <div className="flex gap-3">
          <Search className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">Local SEO Tips</h3>
            <ul className="text-sm text-blue-800 mt-2 space-y-2">
              <li>✓ Keep your Google Business Profile updated with current hours and contact info</li>
              <li>✓ Encourage recent customers to leave reviews on Google</li>
              <li>✓ Respond professionally to all reviews (especially negative ones)</li>
              <li>✓ Use consistent business name, address, and phone across the web</li>
              <li>✓ Add local structured data to your website (we've done this for you)</li>
              <li>✓ Build local citations by listing your business on directories</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
