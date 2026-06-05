import type { Metadata } from "next";
import { FormBuilderEditor } from "@/components/form-builder-editor";

export const metadata: Metadata = { title: "New Form · Lead Capture" };

export default function NewFormPage() {
  return <FormBuilderEditor />;
}
