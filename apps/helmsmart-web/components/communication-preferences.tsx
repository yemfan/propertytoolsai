"use client";

import { useState } from "react";
import { Bell, CheckCircle2, AlertCircle } from "lucide-react";
import { updateClientPreferences } from "@/lib/actions/communication-logs";

interface Preferences {
  opted_out_sms?: boolean;
  opted_out_email?: boolean;
  opted_out_calls?: boolean;
  preferred_contact_method?: string;
  best_time_to_contact?: string;
  notes?: string;
}

interface Props {
  clientId: string;
  initialPreferences?: Preferences;
}

export function CommunicationPreferences({
  clientId,
  initialPreferences,
}: Props) {
  const [preferences, setPreferences] = useState<Preferences>(
    initialPreferences || {}
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (
    key: keyof Preferences,
    value: boolean | string
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setSaved(false);

    setSaving(true);
    setError(null);

    const result = await updateClientPreferences(clientId, updated);
    setSaving(false);

    if (result.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result.error || "Failed to save preferences");
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-slate-700" />
        <h3 className="text-lg font-semibold text-slate-900">
          Communication Preferences
        </h3>
      </div>

      <div className="space-y-6">
        {/* Opt-outs */}
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 mb-4">
            Notification Opt-outs
          </p>
          <div className="space-y-3">
            {[
              {
                key: "opted_out_sms",
                label: "SMS Messages",
                description: "Opt out from text messages",
              },
              {
                key: "opted_out_email",
                label: "Email",
                description: "Opt out from email messages",
              },
              {
                key: "opted_out_calls",
                label: "Phone Calls",
                description: "Opt out from phone calls",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={
                    preferences[item.key as keyof Preferences] === true
                  }
                  onChange={(e) =>
                    handleToggle(item.key as keyof Preferences, e.target.checked)
                  }
                  disabled={saving}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer disabled:opacity-50"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Contact preferences */}
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 mb-4">
            Contact Preferences
          </p>
          <div className="space-y-4">
            {/* Preferred contact method */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Preferred Contact Method
              </label>
              <select
                value={preferences.preferred_contact_method || "any"}
                onChange={(e) =>
                  handleToggle("preferred_contact_method", e.target.value)
                }
                disabled={saving}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="any">Any method</option>
                <option value="sms">SMS only</option>
                <option value="email">Email only</option>
                <option value="call">Phone call only</option>
              </select>
            </div>

            {/* Best time to contact */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Best Time to Contact
              </label>
              <select
                value={preferences.best_time_to_contact || ""}
                onChange={(e) =>
                  handleToggle("best_time_to_contact", e.target.value)
                }
                disabled={saving}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">No preference</option>
                <option value="morning">Morning (6am - 12pm)</option>
                <option value="afternoon">Afternoon (12pm - 6pm)</option>
                <option value="evening">Evening (6pm - 10pm)</option>
                <option value="weekdays">Weekdays only</option>
                <option value="weekends">Weekends only</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={preferences.notes || ""}
                onChange={(e) => handleToggle("notes", e.target.value)}
                disabled={saving}
                placeholder='e.g., "prefers email after 5pm", "do not call on Mondays"'
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Status messages */}
        <div className="flex items-center gap-2 min-h-6">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Saved successfully
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-600">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {saving && (
            <div className="text-sm text-slate-500">Saving...</div>
          )}
        </div>
      </div>
    </div>
  );
}
