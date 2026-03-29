"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/marketing/trackEvent";

/** Fires once per mount for programmatic SEO landing pages. */
export function SeoPageViewTracker({ slug, template }: { slug: string; template: string }) {
  useEffect(() => {
    trackEvent("seo_page_view", { seo_slug: slug, seo_template: template });
  }, [slug, template]);

  return null;
}
