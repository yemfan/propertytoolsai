"use client";

export function HotLeadAlertPanel({
  title,
  reason,
  latestMessage,
}: {
  title: string;
  reason: string;
  latestMessage: string;
}) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 shadow-sm">
      <div className="border-b border-red-200 px-5 py-4">
        <h2 className="text-base font-semibold text-red-800">{title}</h2>
      </div>
      <div className="space-y-2 p-5 text-sm text-red-900">
        <div>
          <strong>Reason:</strong> {reason}
        </div>
        <div>
          <strong>Latest message:</strong> {latestMessage}
        </div>
        <div className="font-medium">Recommended: call or text back soon.</div>
      </div>
    </section>
  );
}
