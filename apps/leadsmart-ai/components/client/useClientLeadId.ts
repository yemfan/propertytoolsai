"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "leadsmart_client_lead_id";

export function useClientLeadId(
  primaryFromApi: string | null,
  validIds?: string[] | null
) {
  const [leadId, setLeadIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const allowed = validIds?.length ? new Set(validIds) : null;
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && (!allowed || allowed.has(stored))) {
      setLeadIdState(stored);
      return;
    }
    if (stored && allowed && !allowed.has(stored)) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    if (primaryFromApi) {
      window.localStorage.setItem(STORAGE_KEY, primaryFromApi);
      setLeadIdState(primaryFromApi);
    }
  }, [primaryFromApi, validIds?.join(",")]);

  const setLeadId = useCallback((id: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    setLeadIdState(id);
  }, []);

  return { leadId: leadId ?? primaryFromApi, setLeadId };
}
