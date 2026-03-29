export function isHotLeadFromSms(params: {
  inferredIntent?: string | null;
  needsHuman?: boolean;
  hotLead?: boolean;
  body: string;
}) {
  const text = params.body.toLowerCase();

  if (params.needsHuman) return true;
  if (params.hotLead) return true;
  if (
    ["appointment", "seller_list_home", "buyer_listing_inquiry"].includes(String(params.inferredIntent || ""))
  ) {
    return true;
  }
  if (/(call me|ready now|today|tour|showing|want to list|coming soon|sell now|how soon)/.test(text)) {
    return true;
  }

  return false;
}
