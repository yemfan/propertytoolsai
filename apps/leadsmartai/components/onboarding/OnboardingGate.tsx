"use client";

import { useEffect, useState } from "react";
import { SetupWizard } from "./SetupWizard";

/**
 * Client component that checks if the current agent has completed onboarding.
 * If not, shows the SetupWizard overlay on top of the dashboard.
 */
export function OnboardingGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/onboarding");
        const body = await res.json();
        if (!cancelled && body.ok && !body.onboardingCompleted) {
          setShow(true);
        }
      } catch {
        // Don't block dashboard if check fails
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  return <SetupWizard onComplete={() => setShow(false)} />;
}
