import { ReactNode } from "react";
import Section from "@/components/ui/Section";

/**
 * Shared layout for tool pages — matches calculator routes (e.g. mortgage-calculator):
 * blue page title, gray subtitle, left-aligned max width (no centered "container" shift).
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
    <div className="w-full max-w-6xl space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-blue-600">{title}</h1>
        <p className="mb-8 text-gray-600">{subtitle}</p>
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
