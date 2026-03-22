import { ReactNode } from "react";
import Section from "@/components/ui/Section";

/**
 * Shared layout for tool pages — brand title, Section headers, max width aligned with dashboard.
 */
export default function ToolPageScaffold({
  title,
  subtitle,
  inputTitle = "Inputs",
  inputDescription = "Tool parameters",
  resultTitle = "Results",
  resultDescription = "Output preview",
  inputContent,
  resultContent,
}: {
  title: string;
  subtitle: string;
  inputTitle?: string;
  inputDescription?: string;
  resultTitle?: string;
  resultDescription?: string;
  inputContent: ReactNode;
  resultContent: ReactNode;
}) {
  return (
    <div className="w-full max-w-6xl space-y-8">
      <div className="border-b border-slate-200/80 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">Tool</p>
        <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-600">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={inputTitle} description={inputDescription}>
          {inputContent}
        </Section>
        <Section title={resultTitle} description={resultDescription}>
          {resultContent}
        </Section>
      </div>
    </div>
  );
}
