export type ClusterTopicDefinition = {
  slug: string;
  name: string;
  /** Primary + secondary phrases for prompts */
  keywords: string[];
  /** Other topic slugs for internal linking (same metro) */
  relatedSlugs: string[];
};

export type ClusterPagePayload = {
  insights: string[];
  sections: { heading: string; paragraphs: string[] }[];
  faqs: { question: string; answer: string }[];
  source: "ai" | "fallback";
};

export type ClusterInternalLink = {
  topicSlug: string;
  anchor: string;
  href: string;
};

export type ClusterPageRecord = {
  topic_slug: string;
  location_slug: string;
  city: string;
  state: string;
  primary_keyword: string | null;
  title: string;
  meta_description: string;
  payload: ClusterPagePayload;
  internal_links: ClusterInternalLink[];
  status: "draft" | "published";
};
