import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AcceptButton } from "./accept-client";
import { Building2 } from "lucide-react";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Look up invitation (service client — no session required)
  const serviceSb = createServiceClient();
  const { data: invite } = await serviceSb
    .from("team_invitations")
    .select("id, email, role, expires_at, accepted_at, organization_id")
    .eq("token", token)
    .single();

  // Determine org name
  let orgName = "HelmSmart";
  if (invite?.organization_id) {
    const { data: org } = await serviceSb
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id)
      .single();
    orgName = org?.name ?? "HelmSmart";
  }

  // Error states
  const invalid = !invite;
  const accepted = !!invite?.accepted_at;
  const expired  = invite ? new Date(invite.expires_at) < new Date() : false;

  // Check if user is already signed in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 24px rgba(0,0,0,.07)",
          padding: "48px 40px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 52,
            height: 52,
            background: "#1e88e5",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Building2 style={{ width: 26, height: 26, color: "#fff" }} />
        </div>

        {invalid || accepted || expired ? (
          /* Error state */
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
              {invalid ? "Invalid invitation" : accepted ? "Already accepted" : "Invitation expired"}
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
              {invalid
                ? "This invitation link is invalid or has been revoked."
                : accepted
                ? "This invitation has already been used. Try signing in directly."
                : "This invitation expired. Ask your team admin to send a new one."}
            </p>
            <a
              href="/login"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                background: "#1e88e5",
                color: "#fff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to sign in
            </a>
          </div>
        ) : (
          /* Valid invitation */
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
              You're invited!
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 4px", lineHeight: 1.6 }}>
              <strong style={{ color: "#334155" }}>{orgName}</strong> has invited you to join their workspace as a{" "}
              <strong style={{ color: "#334155", textTransform: "capitalize" }}>{invite.role}</strong>.
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 28px" }}>
              Sent to {invite.email}
            </p>

            {user ? (
              /* Signed in — show accept button */
              <AcceptButton token={token} orgName={orgName} />
            ) : (
              /* Not signed in — redirect to signup with return URL */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href={`/signup?return=/join/${token}`}
                  style={{
                    display: "block",
                    padding: "12px 24px",
                    background: "#1e88e5",
                    color: "#fff",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Create an account & join
                </a>
                <a
                  href={`/login?return=/join/${token}`}
                  style={{
                    display: "block",
                    padding: "12px 24px",
                    border: "1px solid #e2e8f0",
                    color: "#475569",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  Sign in to existing account
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
