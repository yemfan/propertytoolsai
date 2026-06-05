import type { Metadata } from "next";
import { WorkflowEditor } from "@/components/workflow-editor";

export const metadata: Metadata = { title: "New Workflow" };

export default function NewWorkflowPage() {
  return <WorkflowEditor />;
}
