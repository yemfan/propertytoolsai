"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import EntitlementUpgradeModal, {
  upgradeKindToLimitReason,
  type UpgradeLimitKind,
} from "./EntitlementUpgradeModal";
import type { LimitReason } from "@/lib/entitlements/types";
import { FUNNEL_UPGRADE_EVENT } from "@/lib/funnel/emitUpgradePrompt";

type MePayload = {
  entitlement: { plan?: string | null } | null;
};

type Ctx = {
  me: MePayload | null;
  refresh: () => Promise<void>;
  openUpgradeModal: (reasonOrKind: LimitReason | UpgradeLimitKind, message?: string | null) => void;
};

const EntitlementUiContext = createContext<Ctx | null>(null);

export function useAgentEntitlements() {
  const v = useContext(EntitlementUiContext);
  if (!v) {
    throw new Error("useAgentEntitlements must be used under AgentWorkspaceProviders");
  }
  return v;
}

export function AgentWorkspaceProviders({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MePayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<LimitReason | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/entitlements/me", { credentials: "include" });
    if (!res.ok) return;
    const json = (await res.json()) as { entitlement?: MePayload["entitlement"] };
    setMe({ entitlement: json.entitlement ?? null });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openUpgradeModal = useCallback((reasonOrKind: LimitReason | UpgradeLimitKind, _message?: string | null) => {
    const asReason = reasonOrKind as LimitReason;
    const known: LimitReason[] = [
      "no_agent_entitlement",
      "cma_limit_reached",
      "lead_limit_reached",
      "contact_limit_reached",
      "download_limit_reached",
      "team_access_not_enabled",
      "ai_usage_limit_reached",
      "crm_prediction_locked",
      "crm_automation_locked",
      "crm_full_ai_locked",
    ];
    const reason = known.includes(asReason)
      ? asReason
      : upgradeKindToLimitReason(reasonOrKind as UpgradeLimitKind);
    setModalReason(reason);
    setModalOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      me,
      refresh,
      openUpgradeModal,
    }),
    [me, refresh, openUpgradeModal]
  );

  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ limitReason?: LimitReason }>;
      const r = ce.detail?.limitReason;
      if (r) openUpgradeModal(r);
    };
    window.addEventListener(FUNNEL_UPGRADE_EVENT, handler);
    return () => window.removeEventListener(FUNNEL_UPGRADE_EVENT, handler);
  }, [openUpgradeModal]);

  return (
    <EntitlementUiContext.Provider value={value}>
      {children}
      <EntitlementUpgradeModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalReason(null);
        }}
        reason={modalReason}
        plan={me?.entitlement?.plan ?? null}
      />
    </EntitlementUiContext.Provider>
  );
}
