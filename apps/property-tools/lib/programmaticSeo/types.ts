export type ProgrammaticSeoTool = {
  slug: string;
  name: string;
  category: string;
  /** One-line for prompts & meta */
  tagline: string;
  /** Related tool slugs for internal linking */
  relatedSlugs: string[];
};

export type ProgrammaticSeoLocation = {
  slug: string;
  city: string;
  state: string;
};

export type ProgrammaticSeoPayload = {
  insights: string[];
  sections: { heading: string; paragraphs: string[] }[];
  faqs: { question: string; answer: string }[];
  source: "ai" | "fallback";
};
