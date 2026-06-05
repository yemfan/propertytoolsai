"use client";

import { useState, useTransition } from "react";
import { CommunicationTimeline } from "./communication-timeline";
import { logCommunication } from "@/lib/actions/communication-logs";

interface Log {
  id: string;
  type: "call" | "sms" | "email" | "note" | "appointment" | "other";
  direction?: "inbound" | "outbound";
  status?: string;
  body?: string;
  subject?: string;
  duration_seconds?: number;
  sentiment?: string;
  created_at: string;
  from_ai_employee_id?: string;
}

interface Props {
  clientId: string;
  initialLogs: Log[];
}

export function ClientTimelinePanel({ clientId, initialLogs }: Props) {
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [isPending, startTransition] = useTransition();

  const handleAddNote = (noteText: string) => {
    startTransition(async () => {
      const result = await logCommunication({
        clientId,
        type: "note",
        subject: "Note",
        body: noteText,
      });

      if (result.ok && result.logId) {
        // Optimistically add to local state
        const newLog: Log = {
          id: result.logId,
          type: "note",
          subject: "Note",
          body: noteText,
          created_at: new Date().toISOString(),
        };
        setLogs((prev) => [newLog, ...prev]);
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Communication History</h2>
        <span className="text-xs text-slate-400">{logs.length} entries</span>
      </div>
      <div className="p-5">
        <CommunicationTimeline
          logs={logs}
          onAddNote={isPending ? undefined : handleAddNote}
        />
      </div>
    </div>
  );
}
