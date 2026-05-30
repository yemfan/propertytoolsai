"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email?: string;
}

interface TimeSlot {
  date: string;
  time: string;
  label: string;
}

export default function BookingPage() {
  const [step, setStep] = useState<"lead" | "time">("lead");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Mock data - in production, load from API
  const leads: Lead[] = [
    { id: "1", name: "Create New Lead", email: "new@example.com" },
    { id: "2", name: "Jane Smith", email: "jane@example.com" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com" },
  ];

  // Mock available slots - in production, fetch from booking engine
  const timeSlots: TimeSlot[] = [
    { date: "2026-06-02", time: "09:00", label: "Mon, Jun 2 at 9:00 AM" },
    { date: "2026-06-02", time: "10:00", label: "Mon, Jun 2 at 10:00 AM" },
    { date: "2026-06-02", time: "14:00", label: "Mon, Jun 2 at 2:00 PM" },
    { date: "2026-06-03", time: "09:00", label: "Tue, Jun 3 at 9:00 AM" },
    { date: "2026-06-03", time: "11:00", label: "Tue, Jun 3 at 11:00 AM" },
    { date: "2026-06-04", time: "10:00", label: "Wed, Jun 4 at 10:00 AM" },
  ];

  const getLeadName = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    return lead?.name || "";
  };

  const handleBook = () => {
    if (!selectedLead || !selectedSlot) return;
    // In production, call booking API
    alert(
      `Demo scheduled with ${getLeadName(selectedLead)} on ${selectedSlot.label}`
    );
    setStep("lead");
    setSelectedLead("");
    setSelectedSlot(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            Schedule a Demo
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Lead Selection Step */}
        {step === "lead" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Who should we contact?
              </h2>
              <p className="text-gray-600">
                Select a lead or contact to schedule the demo
              </p>
            </div>

            <div className="grid gap-3">
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => {
                    setSelectedLead(lead.id);
                    setStep("time");
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedLead === lead.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">{lead.name}</p>
                  {lead.email && (
                    <p className="text-sm text-gray-500 mt-1">{lead.email}</p>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm text-gray-600 mb-4">
                Don't see your lead?{" "}
                <Link href="/onboarding" className="text-blue-600 hover:text-blue-700 font-medium">
                  Create an account
                </Link>{" "}
                to add more leads
              </p>
            </div>
          </div>
        )}

        {/* Time Selection Step */}
        {step === "time" && (
          <div className="space-y-6">
            <button
              onClick={() => setStep("lead")}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to lead selection
            </button>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Select a time
              </h2>
              <p className="text-gray-600">
                for {getLeadName(selectedLead)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {timeSlots.map((slot) => (
                <button
                  key={`${slot.date}-${slot.time}`}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedSlot?.time === slot.time &&
                    selectedSlot?.date === slot.date
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                  }`}
                >
                  {slot.label.split(" at ")[1]}
                  <div className="text-xs text-gray-500 mt-1">
                    {slot.label.split(" at ")[0]}
                  </div>
                </button>
              ))}
            </div>

            {selectedSlot && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Demo details
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Contact:</strong> {getLeadName(selectedLead)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Time:</strong> {selectedSlot.label}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("lead")}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={!selectedSlot}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Schedule Demo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
