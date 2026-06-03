/**
 * @helm/ui — PackManifest
 *
 * The industry-agnostic shape a vertical "pack" supplies to configure the shell.
 * Core defines the *contract*; each pack (e.g. `@helm/pack-medical`) ships an
 * *instance*; the host app composes the registry and resolves the active one.
 * (Build once, configure many — Core never enumerates verticals: `id` is a string.)
 */
export interface PackManifest {
  /** Stable pack id, e.g. "helm", "medical". */
  id: string;
  /** Product name shown in the wordmark, e.g. "HelmSmart", "DoctorSmart AI". */
  productName: string;
  /** Letter shown in the logo mark, e.g. "H", "D". */
  logoLetter: string;
  /** CSS theme key — set as `data-pack` on the root; matches a `[data-pack]` token block. */
  dataPack: string;
  /** Auth model for the vertical. Regulated verticals isolate (own auth + data island). */
  auth: "isolated" | "shared";
  /** Label overrides applied to nav section titles + item labels (e.g. `{ Clients: "Patients" }`). */
  terms?: Record<string, string>;
  /** Short marketing tagline shown under the wordmark (e.g. on auth pages). */
  tagline?: string;
}
