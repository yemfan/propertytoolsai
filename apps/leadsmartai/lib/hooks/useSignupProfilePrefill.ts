"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export type SignupPrefillAgent = {
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  brokerage: string;
};

export type SignupPrefillConsumer = {
  fullName: string;
  email: string;
  phone: string;
};

const emptyAgent: SignupPrefillAgent = {
  fullName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  brokerage: "",
};

const emptyConsumer: SignupPrefillConsumer = {
  fullName: "",
  email: "",
  phone: "",
};

export type SignupOverlayPrefill = {
  email?: string;
  fullName?: string;
};

/** Prefer overlay (dialog), then URL params (`?email=&fullName=`), then session + `user_profiles`. */
export function useSignupProfilePrefill(
  variant: "agent" | "consumer",
  overlayPrefill?: SignupOverlayPrefill | null
): {
  values: SignupPrefillAgent | SignupPrefillConsumer;
  hasSession: boolean;
  loading: boolean;
} {
  const searchParams = useSearchParams();
  const [values, setValues] = useState<SignupPrefillAgent | SignupPrefillConsumer>(
    variant === "agent" ? emptyAgent : emptyConsumer
  );
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const qEmail = searchParams.get("email");
      const qName = searchParams.get("fullName");
      const overlayEmail = overlayPrefill?.email?.trim() ?? "";
      const overlayName = overlayPrefill?.fullName?.trim() ?? "";
      const urlEmail =
        overlayEmail || (qEmail ? decodeURIComponent(qEmail).trim() : "");
      const urlName =
        overlayName || (qName ? decodeURIComponent(qName).trim() : "");

      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (cancelled) return;
          if (variant === "agent") {
            setValues({
              fullName: urlName,
              email: urlEmail,
              phone: "",
              licenseNumber: "",
              brokerage: "",
            });
          } else {
            setValues({
              fullName: urlName,
              email: urlEmail,
              phone: "",
            });
          }
          setHasSession(false);
          setLoading(false);
          return;
        }

        const user = session.user;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
        const metaPhone = typeof meta.phone === "string" ? meta.phone.trim() : "";

        const { data: prof } = await supabase
          .from("user_profiles")
          .select("full_name, phone, leadsmart_users(license_number, brokerage)")
          .eq("user_id", user.id)
          .maybeSingle();

        const raw = prof as {
          full_name?: string | null;
          phone?: string | null;
          leadsmart_users?: { license_number?: string | null; brokerage?: string | null } | null;
        } | null;
        const lsRaw = raw?.leadsmart_users;
        const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
        const row = {
          full_name: raw?.full_name,
          phone: raw?.phone,
          license_number: ls?.license_number,
          brokerage: ls?.brokerage,
        };

        const authEmail = user.email?.trim() ?? "";
        const fromProfileName = row?.full_name?.trim() ?? "";
        const displayName =
          urlName || fromProfileName || metaName || (authEmail ? authEmail.split("@")[0] : "");

        if (variant === "agent") {
          if (cancelled) return;
          setValues({
            fullName: displayName,
            email: urlEmail || authEmail,
            phone: row?.phone?.trim() || metaPhone || "",
            licenseNumber: row?.license_number?.trim() || "",
            brokerage: row?.brokerage?.trim() || "",
          });
        } else {
          if (cancelled) return;
          setValues({
            fullName: displayName,
            email: urlEmail || authEmail,
            phone: row?.phone?.trim() || metaPhone || "",
          });
        }
        setHasSession(true);
      } catch (e) {
        console.error("[useSignupProfilePrefill]", e);
        if (!cancelled) {
          if (variant === "agent") {
            setValues({
              fullName: urlName,
              email: urlEmail,
              phone: "",
              licenseNumber: "",
              brokerage: "",
            });
          } else {
            setValues({ fullName: urlName, email: urlEmail, phone: "" });
          }
          setHasSession(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, variant, overlayPrefill]);

  return { values, hasSession, loading };
}
