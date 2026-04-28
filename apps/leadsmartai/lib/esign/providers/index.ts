import { docusignParser } from "./docusign";
import { dotloopParser } from "./dotloop";
import type { ProviderParser } from "./types";
import type { ESignProvider } from "../types";

/**
 * Provider registry. The webhook route looks up the parser by the
 * `[provider]` URL segment. Adding a new provider (e.g. HelloSign)
 * is one line here + a new `providers/<name>.ts` module.
 */
const REGISTRY: Record<ESignProvider, ProviderParser> = {
  dotloop: dotloopParser,
  docusign: docusignParser,
  // hellosign: ... (later — uses similar HMAC pattern)
  hellosign: dotloopParser, // placeholder until the HelloSign parser lands
};

export function getProviderParser(provider: string): ProviderParser | null {
  if (provider !== "dotloop" && provider !== "docusign" && provider !== "hellosign") {
    return null;
  }
  return REGISTRY[provider as ESignProvider] ?? null;
}
