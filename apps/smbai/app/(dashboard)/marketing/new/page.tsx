import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampaignForm } from "./campaign-form";

export const metadata: Metadata = { title: "New Campaign · Marketing" };

export default function NewCampaignPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            New Campaign
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Compose and send to a client segment
          </p>
        </div>
        <Link
          href="/marketing"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </Link>
      </div>

      <CampaignForm />
    </div>
  );
}
