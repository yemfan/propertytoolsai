"use client";

import { useEffect, useRef } from "react";
import { useAccess } from "@/components/AccessProvider";

/**
 * Ensures tier/plan refetch after payment even if `?checkout=success` handling races or is skipped.
 */
export function BillingSuccessClient() {
  const { refresh, closePaywall } = useAccess();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      await refresh();
      closePaywall();
    })();
  }, [refresh, closePaywall]);

  return null;
}
