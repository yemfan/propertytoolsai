/**
 * Stedi clearinghouse — real-time insurance eligibility (X12 270/271).
 *
 * DoctorSmart (medical pack) only. Calls Stedi's JSON eligibility endpoint and
 * flattens the 271 `benefitsInformation` into the few fields a front desk cares
 * about: active?, plan, copay, coinsurance, deductible.
 *
 * Auth: raw API key in the Authorization header (no "Bearer"/"Key" prefix), read
 * from STEDI_API_KEY. When the key is absent we return a deterministic MOCK so the
 * flow is testable without a live Stedi account — the moment the key is set in the
 * environment, real checks flow.
 *
 * Docs: https://www.stedi.com/docs/healthcare/api-reference/post-healthcare-eligibility
 */

const STEDI_BASE =
  process.env.STEDI_BASE_URL ?? "https://healthcare.us.stedi.com/2025-06-01";
const ELIGIBILITY_PATH = "/change/medicalnetwork/eligibility/v3";

export interface EligibilityInput {
  /** Requesting provider's NPI. */
  npi: string;
  /** Practice/organization name. */
  organizationName: string;
  /** Payer id — Stedi's tradingPartnerServiceId. */
  payerId: string;
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD or YYYYMMDD. */
  dateOfBirth: string;
  memberId: string;
  /** Defaults to ["30"] (plan coverage). */
  serviceTypeCodes?: string[];
  /** YYYY-MM-DD; defaults to today. */
  dateOfService?: string;
}

export interface EligibilityResult {
  status: "active" | "inactive" | "error";
  planName: string | null;
  copay: number | null;
  /** Coinsurance as a percent, e.g. 20 (not 0.20). */
  coinsurance: number | null;
  deductible: number | null;
  deductibleRemaining: number | null;
  error: string | null;
  raw: unknown;
}

interface Benefit {
  code?: string;
  name?: string;
  serviceTypeCodes?: string[];
  benefitAmount?: string;
  benefitPercent?: string;
  timeQualifierCode?: string;
  coverageLevelCode?: string;
}

const yyyymmdd = (d: string) => d.replace(/-/g, "").slice(0, 8);
const num = (v?: string | null): number | null =>
  v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;

const errorResult = (error: string): EligibilityResult => ({
  status: "error",
  planName: null,
  copay: null,
  coinsurance: null,
  deductible: null,
  deductibleRemaining: null,
  error,
  raw: null,
});

/**
 * Flatten a 271 response. Pure (no I/O) so it can be unit-tested against fixtures.
 * Benefit codes: "1" Active, "6/7/8" Inactive, "B" Co-Payment, "A" Co-Insurance,
 * "C" Deductible (timeQualifierCode "29" = remaining, else total/per-period).
 */
export function parseEligibility(resp: unknown): EligibilityResult {
  const r = (resp ?? {}) as { benefitsInformation?: Benefit[] };
  const benefits: Benefit[] = Array.isArray(r.benefitsInformation)
    ? r.benefitsInformation
    : [];

  const active = benefits.some((b) => b.code === "1");
  const inactive = benefits.some((b) => ["6", "7", "8"].includes(b.code ?? ""));
  const status: EligibilityResult["status"] = active
    ? "active"
    : inactive
      ? "inactive"
      : benefits.length
        ? "active"
        : "inactive";

  const copay = num(benefits.find((b) => b.code === "B")?.benefitAmount);
  const coinsPct = benefits.find((b) => b.code === "A")?.benefitPercent;
  const coinsurance = coinsPct != null && coinsPct !== "" ? Math.round(Number(coinsPct) * 100) : null;
  const deductible = num(
    benefits.find((b) => b.code === "C" && b.timeQualifierCode !== "29")?.benefitAmount,
  );
  const deductibleRemaining = num(
    benefits.find((b) => b.code === "C" && b.timeQualifierCode === "29")?.benefitAmount,
  );
  const planName = benefits.find((b) => b.code === "1")?.name ?? null;

  return {
    status,
    planName,
    copay,
    coinsurance: coinsurance != null && !Number.isNaN(coinsurance) ? coinsurance : null,
    deductible,
    deductibleRemaining,
    error: null,
    raw: resp,
  };
}

/** Run a real-time eligibility check (or a mock when STEDI_API_KEY is unset). */
export async function checkEligibility(input: EligibilityInput): Promise<EligibilityResult> {
  const key = process.env.STEDI_API_KEY;
  if (!key) return mockEligibility();

  const body = {
    tradingPartnerServiceId: input.payerId,
    provider: { organizationName: input.organizationName, npi: input.npi },
    subscriber: {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: yyyymmdd(input.dateOfBirth),
      memberId: input.memberId,
    },
    encounter: {
      serviceTypeCodes: input.serviceTypeCodes ?? ["30"],
      dateOfService: yyyymmdd(input.dateOfService ?? new Date().toISOString().slice(0, 10)),
    },
  };

  try {
    const res = await fetch(`${STEDI_BASE}${ELIGIBILITY_PATH}`, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return errorResult(`Stedi ${res.status}: ${text.slice(0, 200)}`);
    }
    return parseEligibility(await res.json());
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : "Eligibility check failed");
  }
}

/** Deterministic stand-in used until STEDI_API_KEY is configured. */
function mockEligibility(): EligibilityResult {
  return {
    status: "active",
    planName: "MOCK — PPO Plan (set STEDI_API_KEY for live)",
    copay: 30,
    coinsurance: 20,
    deductible: 1500,
    deductibleRemaining: 750,
    error: null,
    raw: { mock: true },
  };
}
