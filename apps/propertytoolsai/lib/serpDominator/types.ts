export const SERP_PAGE_TYPES = ["tool", "landing", "blog", "comparison", "faq"] as const;
export type SerpPageType = (typeof SERP_PAGE_TYPES)[number];

export type SnippetBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "definition"; term: string; definition: string };

export type SerpInternalLink = {
  href: string;
  label: string;
  pageType: SerpPageType;
};

export type SerpPagePayload = {
  pageType: SerpPageType;
  lede?: string;
  sections: { heading: string; paragraphs: string[] }[];
  faqs?: { question: string; answer: string }[];
  comparisonRows?: { label: string; a: string; b: string }[];
  toolCta?: { headline: string; bullets: string[] };
};

export type GeneratedSerpPage = {
  pageType: SerpPageType;
  title: string;
  meta_description: string;
  payload: SerpPagePayload;
  snippet_blocks: SnippetBlock[];
};
