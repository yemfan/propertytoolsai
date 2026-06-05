import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Plus, LayoutTemplate, Clock, CheckSquare } from "lucide-react";
import { listProjectTemplates } from "@/lib/actions/project-templates";
import { ProjectTemplateActions } from "./template-actions";
import { ImportStarterButton } from "./import-starter-button";
import { UseTemplateButton } from "./use-template-button";

export const metadata: Metadata = { title: "Project Templates" };

const COLOR_DOTS: Record<string, string> = {
  indigo:  "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose:    "bg-rose-500",
  amber:   "bg-amber-500",
  violet:  "bg-violet-500",
  slate:   "bg-slate-400",
};

const STARTER_TEMPLATES = [
  {
    name: "Web Design Project",
    description: "Full website design and development cycle",
    color: "indigo",
    budget_hours: 40,
    default_duration_days: 30,
    default_tasks: [
      { title: "Initial discovery call", priority: "high", offset_days: 1 },
      { title: "Wireframes and sitemap", priority: "normal", offset_days: 7 },
      { title: "Design mockups", priority: "normal", offset_days: 14 },
      { title: "Client review and revisions", priority: "normal", offset_days: 18 },
      { title: "Development", priority: "high", offset_days: 25 },
      { title: "Testing and QA", priority: "normal", offset_days: 28 },
      { title: "Launch and handover", priority: "urgent", offset_days: 30 },
    ],
  },
  {
    name: "HVAC Installation",
    description: "Residential HVAC system installation",
    color: "emerald",
    budget_hours: 16,
    default_duration_days: 3,
    default_tasks: [
      { title: "Site assessment", priority: "high", offset_days: 0 },
      { title: "Equipment procurement", priority: "normal", offset_days: 1 },
      { title: "Installation day 1", priority: "urgent", offset_days: 2 },
      { title: "Installation day 2 + testing", priority: "urgent", offset_days: 3 },
      { title: "Client walkthrough and sign-off", priority: "high", offset_days: 3 },
    ],
  },
  {
    name: "Consulting Engagement",
    description: "Monthly consulting retainer",
    color: "violet",
    budget_hours: 20,
    default_duration_days: 30,
    default_tasks: [
      { title: "Kickoff meeting", priority: "high", offset_days: 1 },
      { title: "Week 1 deliverable", priority: "normal", offset_days: 7 },
      { title: "Week 2 check-in", priority: "normal", offset_days: 14 },
      { title: "Week 3 deliverable", priority: "normal", offset_days: 21 },
      { title: "Monthly review + invoice", priority: "high", offset_days: 30 },
    ],
  },
] as const;

export default async function ProjectTemplatesPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const [templates, clientsRes] = await Promise.all([
    listProjectTemplates(),
    supabase
      .from("clients")
      .select("id, first_name, last_name, company")
      .eq("organization_id", orgId)
      .order("first_name"),
  ]);

  const clients = (clientsRes.data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  }[];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/projects" className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">Project Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create projects faster with pre-defined structures and tasks
          </p>
        </div>
        <Link
          href="/projects/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </Link>
      </div>

      {/* Your templates */}
      {templates.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Your templates</h2>
          <div className="grid gap-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${COLOR_DOTS[tpl.color] ?? "bg-indigo-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{tpl.name}</h3>
                      {tpl.usage_count > 0 && (
                        <span className="text-xs text-slate-400">Used {tpl.usage_count}×</span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{tpl.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {tpl.budget_hours && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {tpl.budget_hours}h budget
                        </span>
                      )}
                      {(tpl.default_tasks ?? []).length > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-3 h-3" />
                          {(tpl.default_tasks ?? []).length} tasks
                        </span>
                      )}
                      {tpl.default_duration_days && (
                        <span>{tpl.default_duration_days} day project</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 items-center">
                    <UseTemplateButton templateId={tpl.id} templateName={tpl.name} clients={clients} />
                    <Link
                      href={`/projects/templates/${tpl.id}`}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                    >
                      Edit
                    </Link>
                    <ProjectTemplateActions templateId={tpl.id} templateName={tpl.name} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Starter templates */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          {templates.length === 0 ? "Get started with these templates" : "Add a starter template"}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {STARTER_TEMPLATES.map((tpl) => (
            <div
              key={tpl.name}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${COLOR_DOTS[tpl.color] ?? "bg-indigo-500"}`} />
                <h3 className="font-semibold text-slate-900 text-sm">{tpl.name}</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">{tpl.description}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                <span>{tpl.budget_hours}h budget</span>
                <span>{tpl.default_tasks.length} tasks</span>
                <span>{tpl.default_duration_days}d</span>
              </div>
              <ImportStarterButton template={tpl} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
