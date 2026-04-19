export type RecommendationListing = {
  propertyId: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyType?: string;
  photoUrl?: string;
};

export type AgentPropertyRecommendation = {
  id: string;
  agentId: number | string;
  contactId: string;
  subject: string | null;
  note: string | null;
  listings: RecommendationListing[];
  sentAt: string | null;
  openedAt: string | null;
  firstClickedAt: string | null;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
};
