export function getConditionAdjustmentPct(
  condition?: "poor" | "average" | "good" | "renovated",
  remodeledYear?: number
) {
  let pct = 0;

  switch (condition) {
    case "poor":
      pct -= 0.1;
      break;
    case "average":
      pct += 0;
      break;
    case "good":
      pct += 0.03;
      break;
    case "renovated":
      pct += 0.07;
      break;
    default:
      break;
  }

  if (typeof remodeledYear === "number") {
    const currentYear = new Date().getFullYear();
    if (remodeledYear >= currentYear - 5) pct += 0.02;
  }

  return pct;
}

export function getListingTrendAdjustmentPct(params: {
  activeMedianPpsf?: number | null;
  soldMedianPpsf?: number | null;
}) {
  const active = params.activeMedianPpsf;
  const sold = params.soldMedianPpsf;
  if (!active || !sold) return 0;

  const diff = (active - sold) / sold;

  if (diff > 0.12) return 0.03;
  if (diff > 0.05) return 0.015;
  if (diff < -0.12) return -0.03;
  if (diff < -0.05) return -0.015;
  return 0;
}
