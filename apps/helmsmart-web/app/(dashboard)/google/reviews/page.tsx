import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ReviewReplyForm } from "@/components/review-reply-form";
import { ArrowLeft, StarIcon, MessageSquare } from "lucide-react";

export const metadata: Metadata = { title: "Reviews · Google Business" };

export default async function ReviewsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("google_reviews")
    .select("*")
    .eq("organization_id", orgId)
    .order("review_created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("google_business_profiles")
    .select("business_name")
    .eq("organization_id", orgId)
    .single();

  const unreplied = reviews?.filter((r) => r.response_status === "unreplied") ?? [];
  const positive = reviews?.filter((r) => r.rating >= 4) ?? [];
  const critical = reviews?.filter((r) => r.rating <= 2) ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/google" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">All Reviews</h1>
        <p className="text-sm text-slate-500 mt-0.5">{profile?.business_name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 uppercase">Unreplied</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{unreplied.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 uppercase">Positive (4-5★)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{positive.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 uppercase">Critical (1-2★)</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{critical.length}</p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {reviews && reviews.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {reviews.map((review) => (
              <div key={review.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{review.reviewer_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(review.review_created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                      review.response_status === "replied"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {review.response_status === "replied" ? "✓ Replied" : "• Unreplied"}
                  </span>
                </div>

                {review.review_text && (
                  <p className="text-sm text-slate-700 mb-4 whitespace-pre-wrap">{review.review_text}</p>
                )}

                {review.response_status === "replied" && review.response_text ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-4">
                    <p className="text-xs font-medium text-emerald-900 mb-2">Your response:</p>
                    <p className="text-sm text-emerald-800 whitespace-pre-wrap">{review.response_text}</p>
                    {review.responded_at && (
                      <p className="text-xs text-emerald-600 mt-2">
                        Replied{" "}
                        {new Date(review.responded_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                ) : (
                  <ReviewReplyForm reviewId={review.id} businessLocationId={review.business_profile_id} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-600">No reviews yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
