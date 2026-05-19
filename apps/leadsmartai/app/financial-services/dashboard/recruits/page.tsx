import type { Metadata } from "next";
import RecruitPipelineClient from "./RecruitPipelineClient";

export const metadata: Metadata = {
  title: "Recruit Pipeline · LeadSmart AI",
  robots: { index: false },
};

export default function RecruitPipelinePage() {
  return <RecruitPipelineClient />;
}
