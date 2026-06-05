"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, GripVertical, CheckCircle2, AlertCircle,
  ExternalLink, Copy, Eye,
} from "lucide-react";
import { createForm, updateForm, deleteForm, type FormField } from "@/lib/actions/forms";

const FIELD_TYPES = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
] as const;

const DEFAULT_FIELDS: FormField[] = [
  { id: "name", type: "text", label: "Full Name", placeholder: "Your name", required: true },
  { id: "email", type: "email", label: "Email Address", placeholder: "you@example.com", required: true },
  { id: "phone", type: "phone", label: "Phone Number", placeholder: "(555) 000-0000", required: false },
  { id: "message", type: "textarea", label: "Message", placeholder: "How can we help?", required: false },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function generateFieldId(): string {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

interface Props {
  formId?: string;
  initialValues?: {
    title: string;
    description: string;
    slug: string;
    fields: FormField[];
    successMessage: string;
    autoCreateClient: boolean;
    notifyEmail: string;
    notifySms: boolean;
    redirectUrl: string;
    isActive: boolean;
  };
}

export function FormBuilderEditor({ formId, initialValues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialValues?.title ?? "Contact Us");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "contact");
  const [fields, setFields] = useState<FormField[]>(
    initialValues?.fields ?? DEFAULT_FIELDS
  );
  const [successMessage, setSuccessMessage] = useState(
    initialValues?.successMessage ?? "Thanks! We'll be in touch shortly."
  );
  const [autoCreateClient, setAutoCreateClient] = useState(
    initialValues?.autoCreateClient ?? true
  );
  const [notifyEmail, setNotifyEmail] = useState(initialValues?.notifyEmail ?? "");
  const [redirectUrl, setRedirectUrl] = useState(initialValues?.redirectUrl ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"fields" | "settings">("fields");
  const [slugCopied, setSlugCopied] = useState(false);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!formId) setSlug(generateSlug(v));
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: generateFieldId(),
        type: "text",
        label: "New Field",
        placeholder: "",
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!title.trim() || !slug.trim()) {
      setError("Title and URL slug are required.");
      return;
    }
    if (fields.length === 0) {
      setError("Add at least one field.");
      return;
    }
    setError(null);
    setSaved(false);

    startTransition(async () => {
      if (formId) {
        const result = await updateForm(formId, {
          title: title.trim(),
          description: description.trim(),
          slug: slug.trim(),
          fields,
          successMessage: successMessage.trim(),
          autoCreateClient,
          notifyEmail: notifyEmail.trim(),
          redirectUrl: redirectUrl.trim(),
          isActive,
        });
        if (!result.ok) {
          setError(result.error ?? "Failed to save");
        } else {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } else {
        const result = await createForm({
          title: title.trim(),
          description: description.trim(),
          slug: slug.trim(),
          fields,
          successMessage: successMessage.trim(),
          autoCreateClient,
          notifyEmail: notifyEmail.trim(),
          redirectUrl: redirectUrl.trim(),
        });
        if (!result.ok) {
          setError(result.error ?? "Failed to create");
        } else {
          router.push(`/forms/${result.formId}`);
        }
      }
    });
  };

  const handleDelete = () => {
    if (!formId || !confirm("Delete this form? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteForm(formId);
      router.push("/forms");
    });
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${appUrl}/f/${slug}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setSlugCopied(true);
    setTimeout(() => setSlugCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/forms"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">
            {formId ? "Edit Form" : "New Form"}
          </h1>
        </div>
        <div className="flex gap-2">
          {formId && (
            <a
              href={`/f/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </>
            ) : isPending ? (
              "Saving…"
            ) : (
              "Save Form"
            )}
          </button>
        </div>
      </div>

      {/* Form title + URL */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Form Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isPending}
              placeholder="e.g. Contact Us, Get a Quote"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              URL Slug <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                <span className="text-xs text-slate-400 px-2 whitespace-nowrap">/f/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  disabled={isPending}
                  className="flex-1 text-sm py-2.5 pr-3 focus:outline-none disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={copyUrl}
                disabled={!formId}
                title="Copy public URL"
                className="p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 disabled:opacity-30 transition-colors"
              >
                {slugCopied ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            placeholder="Shown above the form"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
        {(["fields", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "fields" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Form Fields</h2>
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add field
            </button>
          </div>

          <div className="divide-y divide-slate-50">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-2 text-slate-300 cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    {/* Label */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        disabled={isPending}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </div>
                    {/* Type */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Type
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(index, { type: e.target.value as FormField["type"] })}
                        disabled={isPending}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Placeholder */}
                    {field.type !== "checkbox" && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={field.placeholder ?? ""}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          disabled={isPending}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                    )}
                    {/* Options for select */}
                    {field.type === "select" && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          Options (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={(field.options ?? []).join(", ")}
                          onChange={(e) =>
                            updateField(index, {
                              options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                            })
                          }
                          disabled={isPending}
                          placeholder="Option 1, Option 2, Option 3"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                    )}
                    {/* Required toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`required-${field.id}`}
                        checked={field.required ?? false}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        disabled={isPending}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                      />
                      <label
                        htmlFor={`required-${field.id}`}
                        className="text-xs font-medium text-slate-600 cursor-pointer"
                      >
                        Required field
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    disabled={isPending || fields.length <= 1}
                    className="mt-2 p-1.5 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-5">
          {/* Success message */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">After submission</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Success message
                </label>
                <input
                  type="text"
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  disabled={isPending}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Redirect URL (optional)
                </label>
                <input
                  type="url"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  disabled={isPending}
                  placeholder="https://your-site.com/thank-you"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* CRM & notifications */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">CRM & Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreateClient}
                  onChange={(e) => setAutoCreateClient(e.target.checked)}
                  disabled={isPending}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Auto-create lead in CRM</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every submission automatically creates or matches a contact
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Notify email on submission
                </label>
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="you@business.com"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Active toggle */}
          {formId && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Status</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isPending}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Form is active</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inactive forms show a "form not found" page
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Delete */}
          {formId && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-rose-800 mb-1">Danger zone</h3>
              <p className="text-xs text-rose-600 mb-4">
                Deleting this form is permanent and cannot be undone.
                All submissions will also be deleted.
              </p>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs font-medium text-rose-600 border border-rose-300 rounded-lg px-3 py-1.5 hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                Delete form
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
