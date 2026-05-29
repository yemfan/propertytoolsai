/**
 * Public estimate acceptance portal — /accept/[id]
 * No authentication required; UUID is the capability token.
 */
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { AcceptButtons } from "./accept-buttons";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default async function AcceptEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: est } = await supabase
    .from("estimates")
    .select(`
      id, estimate_number, status, issue_date, expiry_date,
      subtotal, tax_rate, tax_amount, total, notes,
      clients(first_name, last_name, company),
      estimate_lines(description, quantity, unit_price, amount, sort_order),
      organizations(name)
    `)
    .eq("id", id)
    .single();

  if (!est) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = est.expiry_date < today;
  const effectiveStatus = isExpired && est.status === "sent" ? "expired" : est.status;

  const clientRaw = est.clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as {
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  } | null;
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.company
    : null;

  const orgRaw = est.organizations;
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as {
    name: string;
  } | null;

  const lines = (
    Array.isArray(est.estimate_lines) ? est.estimate_lines : []
  ) as {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }[];
  const sortedLines = [...lines].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const isClosed = ["accepted", "declined", "expired"].includes(effectiveStatus);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,.08)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ background: "#0f172a", padding: "28px 40px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: -0.5,
                }}
              >
                {est.estimate_number}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                From {org?.name ?? "your service provider"}
              </div>
              {clientName && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    marginTop: 2,
                  }}
                >
                  For {clientName}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmt(Number(est.total))}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                Valid until{" "}
                {new Date(est.expiry_date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" }
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "32px 40px" }}>
          {/* Closed state banners */}
          {effectiveStatus === "accepted" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 28,
              }}
            >
              <CheckCircle2
                style={{ width: 20, height: 20, color: "#16a34a", flexShrink: 0 }}
              />
              <p style={{ margin: 0, fontSize: 14, color: "#15803d" }}>
                You accepted this estimate. Thank you!
              </p>
            </div>
          )}

          {effectiveStatus === "declined" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 28,
              }}
            >
              <XCircle
                style={{ width: 20, height: 20, color: "#dc2626", flexShrink: 0 }}
              />
              <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>
                This estimate has been declined.
              </p>
            </div>
          )}

          {effectiveStatus === "expired" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 28,
              }}
            >
              <Clock
                style={{ width: 20, height: 20, color: "#d97706", flexShrink: 0 }}
              />
              <p style={{ margin: 0, fontSize: 14, color: "#b45309" }}>
                This estimate expired on{" "}
                {new Date(est.expiry_date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" }
                )}
                .
              </p>
            </div>
          )}

          {/* Line items table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Description", "Qty", "Price", "Amount"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      paddingBottom: 8,
                      textAlign: i === 0 ? "left" : "right",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedLines.map((line, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td
                    style={{
                      padding: "12px 0",
                      fontSize: 14,
                      color: "#334155",
                    }}
                  >
                    {line.description}
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      fontSize: 14,
                      color: "#64748b",
                      textAlign: "right",
                    }}
                  >
                    {Number(line.quantity)}
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      fontSize: 14,
                      color: "#64748b",
                      textAlign: "right",
                    }}
                  >
                    {fmt(Number(line.unit_price))}
                  </td>
                  <td
                    style={{
                      padding: "12px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#0f172a",
                      textAlign: "right",
                    }}
                  >
                    {fmt(Number(line.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 20,
            }}
          >
            <div style={{ width: 220 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "#64748b",
                  padding: "4px 0",
                }}
              >
                <span>Subtotal</span>
                <span>{fmt(Number(est.subtotal))}</span>
              </div>
              {Number(est.tax_rate) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "#64748b",
                    padding: "4px 0",
                  }}
                >
                  <span>
                    Tax ({(Number(est.tax_rate) * 100).toFixed(0)}%)
                  </span>
                  <span>{fmt(Number(est.tax_amount))}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                  borderTop: "2px solid #e2e8f0",
                  paddingTop: 12,
                  marginTop: 8,
                }}
              >
                <span>Total</span>
                <span>{fmt(Number(est.total))}</span>
              </div>
            </div>
          </div>

          {est.notes && (
            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#334155" }}>Notes: </strong>
                {est.notes}
              </p>
            </div>
          )}

          {/* Accept / Decline buttons */}
          {!isClosed && (
            <AcceptButtons estimateId={est.id} />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            padding: "16px 40px",
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          {est.estimate_number} · Powered by HelmSmart
        </div>
      </div>
    </div>
  );
}
