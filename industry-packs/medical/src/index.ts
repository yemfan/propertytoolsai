import type { PackManifest } from "@helm/ui";

/**
 * DoctorSmart AI — the medical industry pack (Slice 1: shell config only).
 *
 * Configuration, not core logic: brand, theme key, auth model, and the
 * terminology that relabels the shared, industry-agnostic Core nav for a clinic.
 * The same Core routes (/home, /clients, /reception…) render — just relabeled.
 *
 * `auth: "isolated"` — medical is regulated; in Slice 2 it gets its own Supabase
 * project (auth + PHI in one BAA'd island). Slice 1 carries the flag but does not
 * yet act on it (demo data only, no PHI).
 */
export const medicalManifest: PackManifest = {
  id: "medical",
  productName: "DoctorSmart AI",
  logoLetter: "D",
  dataPack: "medical",
  auth: "isolated",
  terms: {
    Clients: "Patients",
    Reception: "Front Desk",
    "Voice Agent": "AI Front Desk",
    Pipeline: "Referrals",
    Books: "Billing",
  },
  tagline: "Less paperwork, more patients",
};
