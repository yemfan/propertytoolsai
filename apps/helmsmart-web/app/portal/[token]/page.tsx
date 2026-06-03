import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FileText, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import Link from "next/link";

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

const INV_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:   { label: "Draft",   color: "#94a3b8", icon: FileText },
  sent:    { label: "Sent",    color: "#3b82f6", icon: Clock },
  paid:    { label: "Paid",    color: "#10b981", icon: CheckCircle2 },
  overdue: { label: "Overdue", color: "#f43f5e", icon: AlertCircle },
  void:    { label: "Void",    color: "#94a3b8", icon: XCircle },
};

const EST_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "#94a3b8" },
  sent:     { label: "Sent",     color: "#3b82f6" },
  accepted: { label: "Accepted", color: "#10b981" },
  declined: { label: "Declined", color: "#f43f5e" },
  expired:  { label: "Expired",  color: "#f59e0b" },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 24 }}>
      {children}
    </div>
  );
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const sb = await createServiceClient();

  // Look up client by portal token
  const { data: client } = await sb
    .from("clients")
    .select("id, first_name, last_name, company, email, organization_id")
    .eq("portal_token", token)
    .single();

  if (!client) notFound();

  const clientName =
    [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company || "Client";

  // Load org name
  const { data: org } = await sb
    .from("organizations")
    .select("name")
    .eq("id", client.organization_id)
    .single();
  const orgName = org?.name ?? "HelmSmart";

  // Load invoices
  const { data: invoicesRaw } = await sb
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, total, paid_at")
    .eq("client_id", client.id)
    .neq("status", "draft")
    .order("issue_date", { ascending: false });

  // Load estimates
  const { data: estimatesRaw } = await sb
    .from("estimates")
    .select("id, estimate_number, status, issue_date, expiry_date, total")
    .eq("client_id", client.id)
    .neq("status", "draft")
    .order("issue_date", { ascending: false });

  const invoices  = invoicesRaw ?? [];
  const estimates = estimatesRaw ?? [];

  const totalPaid        = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const totalOutstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header bar */}
      <div style={{ background: "#1e88e5", padding: "16px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{orgName}</span>
          <span style={{ color: "#aad4f7", fontSize: 13 }}>Client Portal</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        {/* Greeting */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
            Hi, {clientName}
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Here's a summary of your account with {orgName}.
          </p>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Amount paid", value: fmt(totalPaid), color: "#10b981" },
            { label: "Outstanding", value: fmt(totalOutstanding), color: totalOutstanding > 0 ? "#f43f5e" : "#94a3b8" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>
                {label}
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Invoices */}
        {invoices.length > 0 && (
          <Card>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#334155", margin: 0 }}>Invoices</h2>
            </div>
            {invoices.map((inv, i) => {
              const cfg = INV_STATUS[inv.status] ?? INV_STATUS.sent;
              const StatusIcon = cfg.icon;
              const isLast = i === invoices.length - 1;
              return (
                <div key={inv.id} style={{ padding: "14px 24px", borderBottom: isLast ? "none" : "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>
                        {inv.invoice_number}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, display: "flex", alignItems: "center", gap: 4 }}>
                        <StatusIcon style={{ width: 11, height: 11 }} />
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>
                      Issued {inv.issue_date} · Due {inv.due_date}
                    </p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#334155", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(inv.total)}
                  </span>
                  {(inv.status === "sent" || inv.status === "overdue") && (
                    <a
                      href={`${appUrl}/pay/${inv.id}`}
                      style={{
                        padding: "7px 16px",
                        background: "#1e88e5",
                        color: "#fff",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                    >
                      Pay now
                    </a>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {/* Estimates */}
        {estimates.length > 0 && (
          <Card>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#334155", margin: 0 }}>Estimates</h2>
            </div>
            {estimates.map((est, i) => {
              const cfg = EST_STATUS[est.status] ?? EST_STATUS.sent;
              const isLast = i === estimates.length - 1;
              return (
                <div key={est.id} style={{ padding: "14px 24px", borderBottom: isLast ? "none" : "1px solid #f8fafc", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", fontFamily: "monospace" }}>
                        {est.estimate_number}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>
                      Issued {est.issue_date}
                      {est.expiry_date ? ` · Expires ${est.expiry_date}` : ""}
                    </p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#334155", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(est.total)}
                  </span>
                  {est.status === "sent" && (
                    <a
                      href={`${appUrl}/accept/${est.id}`}
                      style={{
                        padding: "7px 16px",
                        background: "#f8fafc",
                        color: "#1e88e5",
                        border: "1px solid #d2e8fb",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                    >
                      Review
                    </a>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {invoices.length === 0 && estimates.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <p style={{ fontSize: 14 }}>No invoices or estimates yet.</p>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 40 }}>
          Powered by HelmSmart · {orgName}
        </p>
      </div>
    </div>
  );
}
