import type { Metadata } from "next";
import { ProjectTemplateEditor } from "@/components/project-template-editor";

export const metadata: Metadata = { title: "New Project Template" };

export default function NewProjectTemplatePage() {
  return <ProjectTemplateEditor />;
}
